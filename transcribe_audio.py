#!/usr/bin/env python3
"""
Local audio transcription CLI.

Setup:
  brew install ffmpeg
  python -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  export OPENAI_API_KEY="..."
  python transcribe_audio.py interview.m4a

Useful commands:
  python transcribe_audio.py interview.m4a --estimate-only
  python transcribe_audio.py interview.m4a --yes
  python transcribe_audio.py --costs
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import error, parse, request


DEFAULT_MODEL = "gpt-4o-transcribe"
DEFAULT_LANGUAGE = "he"
DEFAULT_PROMPT = (
    "This is a Hebrew and English technical interview about AI infrastructure, "
    "software development, cloud, startups, and engineering. Preserve technical "
    "terms in English when spoken. Use clear punctuation."
)

MP3_BITRATE = "64k"
SAMPLE_RATE = "16000"
CHANNELS = "1"
SECONDS_PER_MINUTE = 60
BYTES_PER_MB = 1024 * 1024

# Current OpenAI pricing page values checked on 2026-06-30. Pass
# --price-per-minute to override if pricing changes.
DEFAULT_PRICE_PER_MINUTE_USD = {
    "gpt-4o-transcribe": 0.006,
    "gpt-4o-mini-transcribe": 0.003,
    "gpt-4o-transcribe-diarize": 0.006,
    "whisper-1": 0.006,
}


class CliError(Exception):
    """User-facing error."""


@dataclass(frozen=True)
class AudioChunk:
    path: Path
    start_seconds: float
    end_seconds: float


@dataclass(frozen=True)
class CostEstimate:
    duration_seconds: float
    price_per_minute: float | None

    @property
    def duration_minutes(self) -> float:
        return self.duration_seconds / SECONDS_PER_MINUTE

    @property
    def estimated_cost(self) -> float | None:
        if self.price_per_minute is None:
            return None
        return self.duration_minutes * self.price_per_minute


def load_environment() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return

    load_dotenv(".env.local", override=False)
    load_dotenv(override=False)


def require_nonempty_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise CliError(
            f"{name} is missing. Export it or add it to .env.local before transcribing."
        )
    return value


def resolve_executable(name: str) -> str:
    path = shutil.which(name)
    if path:
        return path

    raise CliError(
        f"{name} is not installed or is not on PATH. Install ffmpeg with: brew install ffmpeg"
    )


def run_command(command: list[str]) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise CliError(f"Missing executable: {command[0]}") from exc
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.strip() or exc.stdout.strip() or str(exc)
        raise CliError(stderr) from exc


def probe_duration(ffprobe: str, input_path: Path) -> float:
    result = run_command(
        [
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(input_path),
        ]
    )

    try:
        duration = float(result.stdout.strip())
    except ValueError as exc:
        raise CliError("Could not detect the input duration with ffprobe.") from exc

    if not math.isfinite(duration) or duration <= 0:
        raise CliError("Could not detect a valid audio duration.")

    return duration


def convert_to_mp3(ffmpeg: str, input_path: Path, output_path: Path) -> None:
    run_command(
        [
            ffmpeg,
            "-y",
            "-i",
            str(input_path),
            "-vn",
            "-map",
            "0:a:0",
            "-ac",
            CHANNELS,
            "-ar",
            SAMPLE_RATE,
            "-codec:a",
            "libmp3lame",
            "-b:a",
            MP3_BITRATE,
            str(output_path),
        ]
    )


def split_mp3(
    ffmpeg: str,
    input_path: Path,
    output_dir: Path,
    segment_seconds: int,
) -> list[Path]:
    pattern = output_dir / "chunk-%03d.mp3"
    run_command(
        [
            ffmpeg,
            "-y",
            "-i",
            str(input_path),
            "-f",
            "segment",
            "-segment_time",
            str(segment_seconds),
            "-c",
            "copy",
            "-reset_timestamps",
            "1",
            str(pattern),
        ]
    )

    chunks = sorted(output_dir.glob("chunk-*.mp3"))
    if not chunks:
        raise CliError("ffmpeg did not generate any chunks.")
    return chunks


def bytes_to_mb(size_bytes: int) -> float:
    return size_bytes / BYTES_PER_MB


def format_size(size_bytes: int) -> str:
    return f"{bytes_to_mb(size_bytes):.2f} MB"


def format_timestamp(seconds: float) -> str:
    total = max(0, int(round(seconds)))
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def output_path_for(input_path: Path, output_arg: str | None) -> Path:
    if output_arg:
        return Path(output_arg).expanduser()
    return input_path.with_name(f"{input_path.name}.transcript.md")


def estimate_price_per_minute(
    model: str,
    explicit_price: float | None,
) -> float | None:
    if explicit_price is not None:
        return explicit_price
    return DEFAULT_PRICE_PER_MINUTE_USD.get(model)


def print_estimate(model: str, estimate: CostEstimate) -> None:
    print(f"Detected duration: {format_timestamp(estimate.duration_seconds)}")
    print(f"Model: {model}")

    if estimate.price_per_minute is None:
        print("Estimated API cost: unknown for this model")
        print("Pass --price-per-minute to enable a cost estimate.")
        return

    print(f"Price used: ${estimate.price_per_minute:.4f} / minute")
    print(f"Estimated API cost: ${estimate.estimated_cost:.4f}")


def prepare_chunks(
    ffmpeg: str,
    ffprobe: str,
    input_path: Path,
    temp_dir: Path,
    duration_seconds: float,
    chunk_minutes: float,
    max_bytes: int,
) -> tuple[Path, list[AudioChunk]]:
    compressed_path = temp_dir / "compressed.mp3"
    print("Compressing to mono 16 kHz MP3 at 64 kbps...")
    convert_to_mp3(ffmpeg, input_path, compressed_path)

    compressed_size = compressed_path.stat().st_size
    print(f"Compressed file size: {format_size(compressed_size)}")

    if compressed_size <= max_bytes:
        return (
            compressed_path,
            [AudioChunk(compressed_path, 0, duration_seconds)],
        )

    estimated_bytes_per_second = max(compressed_size / duration_seconds, 1)
    size_based_seconds = int((max_bytes / estimated_bytes_per_second) * 0.90)
    requested_seconds = int(chunk_minutes * SECONDS_PER_MINUTE)
    segment_seconds = max(10, min(requested_seconds, size_based_seconds))

    for attempt in range(8):
        chunk_dir = temp_dir / f"chunks-{attempt}"
        chunk_dir.mkdir(exist_ok=True)
        chunks = split_mp3(ffmpeg, compressed_path, chunk_dir, segment_seconds)
        largest = max(path.stat().st_size for path in chunks)

        if largest <= max_bytes:
            audio_chunks: list[AudioChunk] = []
            current_start = 0.0
            for path in chunks:
                chunk_duration = probe_duration(ffprobe, path)
                audio_chunks.append(
                    AudioChunk(path, current_start, current_start + chunk_duration)
                )
                current_start += chunk_duration
            return compressed_path, audio_chunks

        shutil.rmtree(chunk_dir, ignore_errors=True)
        if segment_seconds <= 10:
            break
        segment_seconds = max(10, int(segment_seconds * 0.70))

    raise CliError(
        f"A generated chunk is still larger than the upload limit of {format_size(max_bytes)}."
    )


def confirm_spend(args: argparse.Namespace, estimate: CostEstimate) -> None:
    if args.yes:
        return

    if args.estimate_only:
        return

    if not sys.stdin.isatty():
        raise CliError("Refusing to spend without --yes in a non-interactive shell.")

    cost = (
        "unknown"
        if estimate.estimated_cost is None
        else f"${estimate.estimated_cost:.4f}"
    )
    answer = input(f"Proceed with transcription? Estimated API cost: {cost} [y/N] ")
    if answer.strip().lower() not in {"y", "yes"}:
        raise CliError("Cancelled before making any OpenAI API calls.")


def retry_delay(attempt: int) -> float:
    return min(60.0, (2**attempt) + random.uniform(0, 0.75))


def should_retry_openai_error(exc: Exception) -> bool:
    non_retryable = {
        "AuthenticationError",
        "BadRequestError",
        "NotFoundError",
        "PermissionDeniedError",
        "UnprocessableEntityError",
    }
    return exc.__class__.__name__ not in non_retryable


def extract_transcript_text(response: Any) -> str:
    text = getattr(response, "text", None)
    if isinstance(text, str):
        return text

    if isinstance(response, dict) and isinstance(response.get("text"), str):
        return response["text"]

    raise CliError("The transcription response did not include text.")


def transcribe_chunk(
    client: Any,
    chunk: AudioChunk,
    model: str,
    language: str | None,
    prompt: str | None,
    retries: int,
) -> str:
    kwargs: dict[str, Any] = {"model": model}
    if language:
        kwargs["language"] = language
    if prompt:
        kwargs["prompt"] = prompt

    for attempt in range(retries + 1):
        try:
            with chunk.path.open("rb") as audio_file:
                response = client.audio.transcriptions.create(
                    file=audio_file,
                    **kwargs,
                )
            return extract_transcript_text(response).strip()
        except Exception as exc:
            if attempt >= retries or not should_retry_openai_error(exc):
                raise

            delay = retry_delay(attempt)
            print(
                f"API error on attempt {attempt + 1}: {exc}. "
                f"Retrying in {delay:.1f}s..."
            )
            time.sleep(delay)

    raise CliError("Transcription failed after retries.")


def build_transcript(chunks: list[AudioChunk], texts: list[str]) -> str:
    sections: list[str] = []
    for index, (chunk, text) in enumerate(zip(chunks, texts), start=1):
        header = (
            f"[Part {index} / {format_timestamp(chunk.start_seconds)}-"
            f"{format_timestamp(chunk.end_seconds)}]"
        )
        sections.append(f"{header}\n\n{text.strip()}")
    return "\n\n".join(sections).strip() + "\n"


def copy_chunks(chunks: list[AudioChunk], input_path: Path) -> Path:
    output_dir = input_path.with_name(f"{input_path.stem}.chunks")
    output_dir.mkdir(exist_ok=True)
    for index, chunk in enumerate(chunks, start=1):
        shutil.copy2(chunk.path, output_dir / f"part-{index:03d}.mp3")
    return output_dir


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    if not stripped or stripped.lower() in {"auto", "none", "null"}:
        return None
    return stripped


def validate_args(args: argparse.Namespace) -> None:
    if args.chunk_minutes <= 0:
        raise CliError("--chunk-minutes must be greater than 0.")
    if args.max_mb <= 0:
        raise CliError("--max-mb must be greater than 0.")
    if args.retries < 0:
        raise CliError("--retries must be 0 or greater.")
    if args.price_per_minute is not None and args.price_per_minute < 0:
        raise CliError("--price-per-minute must be 0 or greater.")


def show_costs() -> bool:
    admin_key = os.environ.get("OPENAI_ADMIN_KEY", "").strip()
    if not admin_key:
        print(
            "OPENAI_ADMIN_KEY is missing. The official OpenAI organization costs "
            "endpoint uses an admin key, not a normal project API key."
        )
        print(
            "Remaining credit balance is not exposed here via a public API. "
            "Add OPENAI_ADMIN_KEY to .env.local to show month-to-date costs."
        )
        return False

    now = datetime.now(timezone.utc)
    start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    query = parse.urlencode(
        {
            "start_time": int(start.timestamp()),
            "end_time": int(now.timestamp()),
            "bucket_width": "1d",
            "limit": 180,
        }
    )
    url = f"https://api.openai.com/v1/organization/costs?{query}"
    req = request.Request(url, headers={"Authorization": f"Bearer {admin_key}"})

    try:
        with request.urlopen(req, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            message = json.loads(body).get("error", {}).get("message", body)
        except json.JSONDecodeError:
            message = body
        raise CliError(f"Could not fetch OpenAI organization costs: {message}") from exc
    except Exception as exc:
        raise CliError(f"Could not fetch OpenAI organization costs: {exc}") from exc

    total_by_currency: dict[str, float] = {}
    for bucket in payload.get("data", []):
        for result in bucket.get("results", []):
            amount = result.get("amount") or {}
            currency = amount.get("currency")
            value = amount.get("value")
            if isinstance(currency, str) and isinstance(value, (int, float)):
                total_by_currency[currency.upper()] = (
                    total_by_currency.get(currency.upper(), 0.0) + float(value)
                )

    if not total_by_currency:
        print("OpenAI month-to-date costs: no cost rows returned.")
        return True

    print(
        "OpenAI month-to-date costs "
        f"({start.date().isoformat()} to {now.date().isoformat()} UTC):"
    )
    for currency, value in sorted(total_by_currency.items()):
        print(f"  {currency} {value:.4f}")
    return True


def run_transcription(args: argparse.Namespace) -> None:
    input_path = Path(args.input_file).expanduser()
    if not input_path.is_file():
        raise CliError(f"Input file not found: {input_path}")

    ffmpeg = resolve_executable("ffmpeg")
    ffprobe = resolve_executable("ffprobe")
    max_bytes = int(args.max_mb * BYTES_PER_MB)

    duration_seconds = probe_duration(ffprobe, input_path)
    price_per_minute = estimate_price_per_minute(args.model, args.price_per_minute)
    estimate = CostEstimate(duration_seconds, price_per_minute)
    print_estimate(args.model, estimate)

    with tempfile.TemporaryDirectory(prefix="transcribe-audio-") as temp_name:
        temp_dir = Path(temp_name)
        _, chunks = prepare_chunks(
            ffmpeg=ffmpeg,
            ffprobe=ffprobe,
            input_path=input_path,
            temp_dir=temp_dir,
            duration_seconds=duration_seconds,
            chunk_minutes=args.chunk_minutes,
            max_bytes=max_bytes,
        )

        print(f"Number of chunks: {len(chunks)}")
        for index, chunk in enumerate(chunks, start=1):
            chunk_size = chunk.path.stat().st_size
            print(
                f"  Chunk {index}: {format_timestamp(chunk.start_seconds)}-"
                f"{format_timestamp(chunk.end_seconds)}, {format_size(chunk_size)}"
            )
            if chunk_size > max_bytes:
                raise CliError(
                    f"Chunk {index} is still larger than {format_size(max_bytes)}."
                )

        if args.keep_chunks:
            chunk_output_dir = copy_chunks(chunks, input_path)
            print(f"Kept chunks in: {chunk_output_dir}")

        if args.estimate_only:
            print("Estimate only: no OpenAI API calls were made.")
            return

        confirm_spend(args, estimate)
        require_nonempty_env("OPENAI_API_KEY")

        try:
            from openai import OpenAI
        except ImportError as exc:
            raise CliError(
                "Missing Python package: openai. Run: pip install -r requirements.txt"
            ) from exc

        client = OpenAI()
        language = normalize_optional_text(args.language)
        prompt = normalize_optional_text(args.prompt)
        if "diarize" in args.model and prompt:
            print("Prompt omitted because diarization transcription does not support prompts.")
            prompt = None
        texts: list[str] = []

        for index, chunk in enumerate(chunks, start=1):
            print(
                f"Transcribing chunk {index}/{len(chunks)} "
                f"({format_timestamp(chunk.start_seconds)}-"
                f"{format_timestamp(chunk.end_seconds)})..."
            )
            texts.append(
                transcribe_chunk(
                    client=client,
                    chunk=chunk,
                    model=args.model,
                    language=language,
                    prompt=prompt,
                    retries=args.retries,
                )
            )

    final_text = build_transcript(chunks, texts)
    output_path = output_path_for(input_path, args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(final_text, encoding="utf-8")
    print(f"Final output path: {output_path}")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Transcribe local audio files with the OpenAI Audio Transcriptions API."
    )
    parser.add_argument("input_file", nargs="?", help="Path to an audio or video file.")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--language", default=DEFAULT_LANGUAGE)
    parser.add_argument("--output")
    parser.add_argument("--chunk-minutes", type=float, default=10.0)
    parser.add_argument("--max-mb", type=float, default=24.0)
    parser.add_argument("--keep-chunks", action="store_true")
    parser.add_argument("--prompt", default=DEFAULT_PROMPT)
    parser.add_argument("--estimate-only", action="store_true")
    parser.add_argument("--yes", action="store_true", help="Skip confirmation after estimate.")
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument(
        "--price-per-minute",
        type=float,
        help="Override the built-in USD per-minute cost estimate for the selected model.",
    )
    parser.add_argument(
        "--costs",
        action="store_true",
        help="Show OpenAI month-to-date costs using OPENAI_ADMIN_KEY.",
    )
    parser.add_argument(
        "--credits",
        action="store_true",
        help="Alias for --costs. The public API reports costs, not remaining credit balance.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    load_environment()
    args = parse_args(argv or sys.argv[1:])

    try:
        validate_args(args)
        wants_costs = bool(args.costs or args.credits)
        if wants_costs:
            costs_ok = show_costs()
            if not args.input_file:
                return 0 if costs_ok else 2

        if not args.input_file:
            raise CliError("Missing input_file. Pass a file path or use --costs.")

        run_transcription(args)
        return 0
    except CliError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Cancelled.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
