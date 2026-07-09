#!/usr/bin/env python3
"""Local, free ASR transcription for Podcast Signals.

Priority engine: faster-whisper. Fallback: openai-whisper.
No paid API is called; all inference runs locally.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List


def hhmmss(seconds: float) -> str:
    seconds = max(0, int(seconds or 0))
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def srt_time(seconds: float) -> str:
    ms = int(round((seconds - math.floor(seconds)) * 1000))
    return f"{hhmmss(seconds)},{ms:03d}"


def vtt_time(seconds: float) -> str:
    ms = int(round((seconds - math.floor(seconds)) * 1000))
    return f"{hhmmss(seconds)}.{ms:03d}"


def load_episode_meta(episode_id: str) -> Dict[str, Any]:
    root = Path.cwd()
    episode_dir = root / "data" / "longform" / "episodes"
    if not episode_dir.exists():
        return {}
    for file in sorted(episode_dir.glob("*.json"), reverse=True):
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
        except Exception:
            continue
        episodes = data.get("episodes", data if isinstance(data, list) else [])
        for episode in episodes:
            if episode.get("id") == episode_id:
                return episode
    return {}


def write_outputs(payload: Dict[str, Any], output_dir: Path, formats: Iterable[str]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    episode_id = payload["episode_id"]
    segments = payload.get("segments", [])
    formats = {f.strip().lower() for f in formats if f.strip()}
    if "json" in formats:
        (output_dir / f"{episode_id}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if "txt" in formats:
        txt_dir = Path("data/transcripts/txt")
        txt_dir.mkdir(parents=True, exist_ok=True)
        (txt_dir / f"{episode_id}.txt").write_text(payload.get("full_text", "") + "\n", encoding="utf-8")
    if "md" in formats:
        md = [f"# {payload.get('title') or episode_id}", "", f"Source: {payload.get('source_name','')}", f"Original: {payload.get('video_url') or payload.get('episode_url') or payload.get('audio_url')}", "", "## Transcript", ""]
        for seg in segments:
            md.append(f"### {seg['start_hhmmss']}")
            md.append(seg["text"])
            md.append("")
        (output_dir / f"{episode_id}.md").write_text("\n".join(md), encoding="utf-8")
    if "srt" in formats:
        srt_dir = Path("data/transcripts/srt")
        srt_dir.mkdir(parents=True, exist_ok=True)
        lines: List[str] = []
        for seg in segments:
            lines += [str(seg["index"] + 1), f"{srt_time(seg['start'])} --> {srt_time(seg['end'])}", seg["text"], ""]
        (srt_dir / f"{episode_id}.srt").write_text("\n".join(lines), encoding="utf-8")
    if "vtt" in formats:
        vtt_dir = Path("data/transcripts/vtt")
        vtt_dir.mkdir(parents=True, exist_ok=True)
        lines = ["WEBVTT", ""]
        for seg in segments:
            lines += [f"{vtt_time(seg['start'])} --> {vtt_time(seg['end'])}", seg["text"], ""]
        (vtt_dir / f"{episode_id}.vtt").write_text("\n".join(lines), encoding="utf-8")


def transcribe_with_faster_whisper(audio: str, model: str, language: str, device: str, compute_type: str) -> Dict[str, Any]:
    from faster_whisper import WhisperModel  # type: ignore

    resolved_device = "cuda" if device == "auto" and os.environ.get("CUDA_VISIBLE_DEVICES") else ("cpu" if device == "auto" else device)
    resolved_compute = "int8" if compute_type == "auto" and resolved_device == "cpu" else ("float16" if compute_type == "auto" else compute_type)
    whisper = WhisperModel(model, device=resolved_device, compute_type=resolved_compute)
    segments_iter, info = whisper.transcribe(
        audio,
        language=None if language == "auto" else language,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 600},
        word_timestamps=False,
        beam_size=5,
    )
    segments = []
    for idx, seg in enumerate(segments_iter):
        text = " ".join(str(seg.text or "").split())
        if not text:
            continue
        segments.append({
            "index": idx,
            "start": float(seg.start),
            "end": float(seg.end),
            "start_hhmmss": hhmmss(float(seg.start)),
            "end_hhmmss": hhmmss(float(seg.end)),
            "speaker": "",
            "text": text,
            "confidence": None,
        })
    return {"segments": segments, "language": getattr(info, "language", language), "duration_seconds": float(getattr(info, "duration", 0) or 0), "engine": "faster-whisper", "device": resolved_device, "compute_type": resolved_compute}


def transcribe_with_openai_whisper(audio: str, model: str, language: str) -> Dict[str, Any]:
    import whisper  # type: ignore

    whisper_model = whisper.load_model(model)
    result = whisper_model.transcribe(audio, language=None if language == "auto" else language, verbose=False)
    segments = []
    for idx, seg in enumerate(result.get("segments", [])):
        text = " ".join(str(seg.get("text", "")).split())
        if not text:
            continue
        segments.append({
            "index": idx,
            "start": float(seg.get("start", 0)),
            "end": float(seg.get("end", 0)),
            "start_hhmmss": hhmmss(float(seg.get("start", 0))),
            "end_hhmmss": hhmmss(float(seg.get("end", 0))),
            "speaker": "",
            "text": text,
            "confidence": None,
        })
    duration = segments[-1]["end"] if segments else 0
    return {"segments": segments, "language": result.get("language", language), "duration_seconds": duration, "engine": "openai-whisper", "device": "local", "compute_type": "default"}


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcribe local audio with faster-whisper or openai-whisper fallback.")
    parser.add_argument("--episode-id", required=True)
    parser.add_argument("--audio", required=True)
    parser.add_argument("--model", default="medium", choices=["large-v3", "medium", "small", "base", "tiny"])
    parser.add_argument("--language", default="auto", choices=["auto", "en", "zh", "ja"])
    parser.add_argument("--device", default="auto")
    parser.add_argument("--compute-type", default="auto")
    parser.add_argument("--output-dir", default="data/transcripts/raw")
    parser.add_argument("--formats", default="json,txt,srt,vtt,md")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    audio = Path(args.audio)
    if not audio.exists():
        print(f"Audio not found: {audio}", file=sys.stderr)
        return 2
    output_dir = Path(args.output_dir)
    output_json = output_dir / f"{args.episode_id}.json"
    if output_json.exists() and not args.force:
        print(f"Transcript already exists: {output_json}. Use --force to overwrite.")
        return 0

    meta = load_episode_meta(args.episode_id)
    try:
        result = transcribe_with_faster_whisper(str(audio), args.model, args.language, args.device, args.compute_type)
    except Exception as first_error:
        print(f"faster-whisper failed: {first_error}. Falling back to openai-whisper.", file=sys.stderr)
        try:
            result = transcribe_with_openai_whisper(str(audio), args.model.replace("large-v3", "large"), args.language)
        except Exception as second_error:
            log_dir = Path("data/longform/runs")
            log_dir.mkdir(parents=True, exist_ok=True)
            log = {"episode_id": args.episode_id, "audio": str(audio), "created_at": datetime.now(timezone.utc).isoformat(), "faster_whisper_error": str(first_error), "openai_whisper_error": str(second_error)}
            (log_dir / f"{args.episode_id}-transcribe-error.json").write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Transcription failed. Error log written for {args.episode_id}.", file=sys.stderr)
            return 1

    full_text = "\n".join(seg["text"] for seg in result["segments"])
    payload = {
        "episode_id": args.episode_id,
        "title": meta.get("title", args.episode_id),
        "source_name": meta.get("source_name", ""),
        "creator_name": meta.get("creator_name", ""),
        "guest_names": meta.get("guest_names", []),
        "episode_url": meta.get("episode_url", ""),
        "video_url": meta.get("video_url", ""),
        "audio_url": meta.get("audio_url", ""),
        "thumbnail_url": meta.get("thumbnail_url", ""),
        "published_at": meta.get("published_at", ""),
        "duration": meta.get("duration", ""),
        "language": result["language"],
        "model": args.model,
        "engine": result["engine"],
        "device": result["device"],
        "compute_type": result["compute_type"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": result["duration_seconds"],
        "segments": result["segments"],
        "full_text": full_text,
    }
    write_outputs(payload, output_dir, args.formats.split(","))
    print(f"Transcribed {len(result['segments'])} segments for {args.episode_id}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
