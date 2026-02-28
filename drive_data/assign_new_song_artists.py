import argparse
import csv
import re
import subprocess
import sys
import tempfile
from pathlib import Path


DEFAULT_PLACEHOLDER_SINGERS = {"סינגלים חדשים"}
DEFAULT_SINGER_LIST_CANDIDATES = [
    "docs/assets/data/singers_list.txt",
    "archive/artists/singers_list.txt",
]
SERIAL_MARKER_REGEX = re.compile(r"\[SN(?P<serial>\d+)\](?:_\d+)?$", re.IGNORECASE)
INVALID_FILENAME_CHARS_REGEX = re.compile(r'[<>:"/\\|?*]')
BIDI_MARKS_REGEX = re.compile(r"[\u200e\u200f\u202a-\u202e\u2066-\u2069]")
SEPARATOR_REGEX = re.compile(r"\s*(?:,|&|/| feat\.?| ft\.?| x )\s*", re.IGNORECASE)


def sanitize_filename_component(text: str, max_length: int = 170) -> str:
    cleaned = INVALID_FILENAME_CHARS_REGEX.sub("", text or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip().rstrip(".")
    if not cleaned:
        cleaned = "song"
    return cleaned[:max_length]


def normalize_text(value: str) -> str:
    text = value or ""
    text = BIDI_MARKS_REGEX.sub("", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Infer artist names for rows in new-songs.csv using singles-sorter-cli "
            "and write them back to the Singer column."
        )
    )
    parser.add_argument(
        "--csv-path",
        default="drive_data/new-songs.csv",
        help="Path to the CSV file to update.",
    )
    parser.add_argument(
        "--sorter-exe",
        required=True,
        help="Path to singles-sorter-cli executable.",
    )
    parser.add_argument(
        "--sorter-runner",
        default="",
        help=(
            "Optional wrapper command used to run the sorter executable "
            "(for example: wine)."
        ),
    )
    parser.add_argument(
        "--singer-list-txt",
        default="",
        help=(
            "Path to singers_list.txt used to build app/singer-list.csv for singles-sorter. "
            "If not provided, known project paths are used."
        ),
    )
    parser.add_argument(
        "--placeholder-singer",
        action="append",
        default=[],
        help=(
            "Singer value that should be treated as placeholder and replaced. "
            "Can be provided multiple times."
        ),
    )
    parser.add_argument(
        "--log-level",
        default="ERROR",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Log level passed to singles-sorter-cli.",
    )
    return parser.parse_args()


def load_rows(csv_path: Path) -> tuple[list[dict], list[str]]:
    if not csv_path.is_file():
        raise FileNotFoundError(f"CSV file was not found: {csv_path}")

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError(f"CSV file has no header: {csv_path}")
        rows = list(reader)
        return rows, reader.fieldnames


def resolve_singer_list_txt_path(candidate: str) -> Path:
    if candidate and candidate.strip():
        path = Path(candidate.strip()).resolve()
        if not path.is_file():
            raise FileNotFoundError(f"Singer list TXT file was not found: {path}")
        return path

    for fallback in DEFAULT_SINGER_LIST_CANDIDATES:
        path = Path(fallback).resolve()
        if path.is_file():
            return path

    raise FileNotFoundError(
        "Could not locate singers list TXT file. "
        f"Tried: {DEFAULT_SINGER_LIST_CANDIDATES}"
    )


def build_sorter_singer_csv(temp_work_dir: Path, singer_list_txt: Path) -> list[str]:
    app_dir = temp_work_dir / "app"
    app_dir.mkdir(parents=True, exist_ok=True)
    singer_csv_path = app_dir / "singer-list.csv"

    unique_names: list[str] = []
    seen = set()
    with singer_list_txt.open("r", encoding="utf-8") as source_handle:
        for line in source_handle:
            name = line.strip()
            if not name:
                continue
            if name in seen:
                continue
            seen.add(name)
            unique_names.append(name)

    if not unique_names:
        raise ValueError(f"Singer list TXT has no usable names: {singer_list_txt}")

    with singer_csv_path.open("w", encoding="utf-8", newline="") as csv_handle:
        writer = csv.writer(csv_handle)
        for name in unique_names:
            writer.writerow([name, name])

    return unique_names


def infer_singer_from_song_name(song_name: str, singer_names: list[str]) -> str | None:
    if not song_name:
        return None

    normalized_song = normalize_text(song_name)
    if not normalized_song:
        return None

    left_side = normalized_song.split(" - ", 1)[0].strip() if " - " in normalized_song else normalized_song
    left_primary = SEPARATOR_REGEX.split(left_side, maxsplit=1)[0].strip()

    candidates = []
    for name in singer_names:
        normalized_name = normalize_text(name)
        if not normalized_name:
            continue
        pos_song = normalized_song.find(normalized_name)
        pos_left = left_side.find(normalized_name)
        if pos_song >= 0:
            candidates.append((0, -len(normalized_name), pos_song, normalized_name))
        elif pos_left >= 0:
            candidates.append((1, -len(normalized_name), pos_left, normalized_name))

    if candidates:
        candidates.sort()
        return candidates[0][3]

    if left_primary:
        word_count = len(left_primary.split())
        if 1 <= word_count <= 8 and left_primary not in DEFAULT_PLACEHOLDER_SINGERS:
            return left_primary

    return None


def build_source_files(
    rows: list[dict],
    source_dir: Path,
    placeholder_values: set[str],
) -> tuple[dict[str, int], int]:
    serial_to_row_index: dict[str, int] = {}
    rows_targeted = 0

    for index, row in enumerate(rows):
        current_singer = (row.get("Singer") or "").strip()
        if current_singer and current_singer not in placeholder_values:
            continue

        serial = (row.get("Serial Number") or "").strip()
        song_name = (row.get("Song Name") or "").strip()
        if not serial or not song_name:
            continue

        serial_to_row_index[serial] = index
        rows_targeted += 1

        base = sanitize_filename_component(song_name)
        suffix_counter = 0
        while True:
            candidate_name = base
            if suffix_counter > 0:
                candidate_name = f"{candidate_name} ({suffix_counter})"
            filename = f"{sanitize_filename_component(candidate_name)} [SN{serial}].mp3"
            candidate_path = source_dir / filename
            if not candidate_path.exists():
                candidate_path.touch()
                break
            suffix_counter += 1

    return serial_to_row_index, rows_targeted


def run_sorter(
    sorter_exe: Path,
    source_dir: Path,
    target_dir: Path,
    log_level: str,
    cwd: Path,
    sorter_runner: str = "",
) -> None:
    command = []
    if sorter_runner.strip():
        command.append(sorter_runner.strip())
    command.extend(
        [
            str(sorter_exe),
            str(source_dir),
            str(target_dir),
            "-n",
            "-m",
            "-l",
            log_level,
        ]
    )
    result = subprocess.run(
        command,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode != 0:
        message = (
            "singles-sorter-cli failed.\n"
            f"exit_code={result.returncode}\n"
            f"stdout:\n{result.stdout}\n"
            f"stderr:\n{result.stderr}\n"
        )
        raise RuntimeError(message)


def collect_artist_by_serial(target_dir: Path) -> dict[str, str]:
    assignments: dict[str, str] = {}

    for song_file in target_dir.rglob("*"):
        if not song_file.is_file():
            continue
        if song_file.suffix.lower() != ".mp3":
            continue

        marker_match = SERIAL_MARKER_REGEX.search(song_file.stem)
        if not marker_match:
            continue

        serial = marker_match.group("serial")
        relative_parts = song_file.relative_to(target_dir).parts
        if not relative_parts:
            continue

        artist_folder = relative_parts[0].strip()
        if artist_folder:
            assignments[serial] = artist_folder

    return assignments


def write_rows(csv_path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    args = parse_args()
    csv_path = Path(args.csv_path).resolve()
    sorter_exe = Path(args.sorter_exe).resolve()

    if not sorter_exe.is_file():
        raise FileNotFoundError(f"Sorter executable was not found: {sorter_exe}")
    singer_list_txt = resolve_singer_list_txt_path(args.singer_list_txt)

    placeholder_values = set(DEFAULT_PLACEHOLDER_SINGERS)
    placeholder_values.update({value.strip() for value in args.placeholder_singer if value and value.strip()})

    rows, fieldnames = load_rows(csv_path)
    if not rows:
        print(f"No rows found in CSV: {csv_path}")
        return 0

    with tempfile.TemporaryDirectory(prefix="new-song-artist-sort-") as temp_dir_str:
        temp_dir = Path(temp_dir_str)
        source_dir = temp_dir / "source"
        target_dir = temp_dir / "target"
        source_dir.mkdir(parents=True, exist_ok=True)
        target_dir.mkdir(parents=True, exist_ok=True)
        singer_names = build_sorter_singer_csv(temp_dir, singer_list_txt)

        serial_to_row_index, rows_targeted = build_source_files(rows, source_dir, placeholder_values)
        if rows_targeted == 0:
            print("No placeholder rows found. Nothing to update.")
            return 0

        run_sorter(
            sorter_exe=sorter_exe,
            source_dir=source_dir,
            target_dir=target_dir,
            log_level=args.log_level,
            cwd=temp_dir,
            sorter_runner=args.sorter_runner,
        )

        artist_by_serial = collect_artist_by_serial(target_dir)

        updated_rows = 0
        fallback_updated_rows = 0
        for serial, artist in artist_by_serial.items():
            index = serial_to_row_index.get(serial)
            if index is None:
                continue
            current_value = normalize_text(rows[index].get("Singer") or "")
            if current_value != artist:
                rows[index]["Singer"] = artist
                updated_rows += 1

        for serial, index in serial_to_row_index.items():
            current_value = normalize_text(rows[index].get("Singer") or "")
            if current_value and current_value not in DEFAULT_PLACEHOLDER_SINGERS:
                continue

            song_name = normalize_text(rows[index].get("Song Name") or "")
            inferred = infer_singer_from_song_name(song_name, singer_names)
            if not inferred:
                continue

            if current_value != inferred:
                rows[index]["Singer"] = inferred
                updated_rows += 1
                fallback_updated_rows += 1

    if updated_rows > 0:
        write_rows(csv_path, rows, fieldnames)

    print(
        "Artist assignment completed: "
        f"targeted={rows_targeted}, assigned={len(artist_by_serial)}, "
        f"fallback_updated={fallback_updated_rows}, updated={updated_rows}"
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
