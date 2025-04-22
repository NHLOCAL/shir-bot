# drive_data/csv_to_yaml_converter.py
import csv
import yaml
import sys
import argparse
from pathlib import Path
import os

def convert_csv_to_yaml(csv_filepath_str, yaml_filepath_str):
    """
    Converts a CSV file (expected format from process_drive_folder.py)
    to a YAML file suitable for Jekyll _data.

    Args:
        csv_filepath_str (str): Path to the input CSV file.
        yaml_filepath_str (str): Path to the output YAML file.
    """
    csv_filepath = Path(csv_filepath_str)
    yaml_filepath = Path(yaml_filepath_str)
    data = []

    print(f"Attempting conversion: {csv_filepath} -> {yaml_filepath}")

    # Ensure the target directory exists
    try:
        yaml_filepath.parent.mkdir(parents=True, exist_ok=True)
        print(f"Ensured output directory exists: {yaml_filepath.parent}")
    except Exception as e:
        print(f"Error creating output directory {yaml_filepath.parent}: {e}", file=sys.stderr)
        sys.exit(1) # Exit if we can't create the directory

    if not csv_filepath.is_file():
        print(f"Warning: Input CSV file not found at {csv_filepath}.", file=sys.stderr)
        # Decide behavior: create empty YAML or do nothing?
        # Let's create an empty YAML list if the CSV is missing,
        # but only if the YAML doesn't already exist or is empty.
        # This prevents overwriting a potentially valid older YAML if the CSV vanished.
        if not yaml_filepath.is_file() or yaml_filepath.stat().st_size == 0:
             print(f"Creating an empty YAML file at {yaml_filepath}.")
             try:
                 with open(yaml_filepath, 'w', encoding='utf-8') as yf:
                     yaml.dump([], yf)
                 # No need to exit, we handled the missing CSV case.
                 return
             except Exception as e:
                 print(f"Error creating empty YAML file {yaml_filepath}: {e}", file=sys.stderr)
                 sys.exit(1)
        else:
            print(f"Existing YAML file found at {yaml_filepath}. Skipping creation of empty YAML.")
            return # Don't overwrite existing valid YAML

    try:
        with open(csv_filepath, 'r', encoding='utf-8') as csvfile:
            # Expected columns: "Serial Number", "Song Name", "Hebrew Date Folder", "Singer", "Copied Drive ID"
            reader = csv.DictReader(csvfile)
            required_keys = ['Serial Number', 'Song Name', 'Hebrew Date Folder', 'Singer', 'Copied Drive ID']

            for i, row in enumerate(reader):
                # Basic validation: Check if all required keys exist and have some value
                if not all(key in row and row[key] for key in required_keys):
                    print(f"Warning: Skipping row {i+1} due to missing/empty required data: {row}", file=sys.stderr)
                    continue

                # Map CSV columns to YAML fields
                song = {
                    'serial': row.get('Serial Number', '').strip(),
                    'name': row.get('Song Name', '').strip(),
                    'album': row.get('Hebrew Date Folder', '').strip(), # Mapping Hebrew Date Folder to 'album'
                    'singer': row.get('Singer', '').strip(),
                    'driveId': row.get('Copied Drive ID', '').strip()   # Mapping Copied Drive ID to 'driveId'
                }
                data.append(song)

        # Write data to YAML file, supporting Hebrew characters
        with open(yaml_filepath, 'w', encoding='utf-8') as yamlfile:
            yaml.dump(data, yamlfile, allow_unicode=True, sort_keys=False) # sort_keys=False preserves order

        print(f"Successfully converted {csv_filepath} to {yaml_filepath}")

    except FileNotFoundError:
        # This case is handled above, but keep for robustness
        print(f"Error: CSV file not found at {csv_filepath} during conversion.", file=sys.stderr)
        sys.exit(1)
    except KeyError as e:
         print(f"Error: Missing expected column in CSV file {csv_filepath}: {e}", file=sys.stderr)
         sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred during CSV to YAML conversion: {e}", file=sys.stderr)
        sys.exit(1) # Signal error to the workflow

if __name__ == "__main__":
    # Setup argument parser
    parser = argparse.ArgumentParser(description='Convert a specific CSV format to YAML for Jekyll.')
    parser.add_argument('--csv-input', required=True, help='Path to the input CSV file (e.g., drive_data/new-songs.csv)')
    parser.add_argument('--yaml-output', required=True, help='Path to the output YAML file (e.g., docs/_data/new_songs.yml)')

    args = parser.parse_args()

    # Call the conversion function with parsed arguments
    convert_csv_to_yaml(args.csv_input, args.yaml_output)