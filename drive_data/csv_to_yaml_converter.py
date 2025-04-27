# drive_data/csv_to_yaml_converter.py
# Updated to handle potential BOM in CSV input using utf-8-sig
# and added explicit header validation.

import csv
import yaml
import sys
import argparse
from pathlib import Path
import traceback # Import traceback for better error details

def convert_csv_to_yaml(csv_filepath_str, yaml_filepath_str):
    """
    Converts a CSV file (expected format from process_drive_folder.py OR
    drive_sync_inventory.py) to a YAML file suitable for Jekyll _data.
    Handles potential UTF-8 BOM in the CSV.

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

    # Handle case where input CSV doesn't exist
    if not csv_filepath.is_file():
        print(f"Warning: Input CSV file not found at {csv_filepath}.", file=sys.stderr)
        # Create empty YAML only if target doesn't exist or is empty
        if not yaml_filepath.is_file() or yaml_filepath.stat().st_size == 0:
             print(f"Creating an empty YAML file at {yaml_filepath} because input CSV was missing.")
             try:
                 with open(yaml_filepath, 'w', encoding='utf-8') as yf:
                     yaml.dump([], yf)
                 return # Successfully handled missing input
             except Exception as e:
                 print(f"Error creating empty YAML file {yaml_filepath}: {e}", file=sys.stderr)
                 sys.exit(1)
        else:
            print(f"Existing YAML file found at {yaml_filepath}. Skipping creation of empty YAML for missing input.")
            return # Don't overwrite existing if input CSV vanishes

    # --- Main Conversion Logic ---
    try:
        # *** Use 'utf-8-sig' encoding to automatically handle BOM ***
        with open(csv_filepath, 'r', encoding='utf-8-sig', newline='') as csvfile:
            # Expected columns: "Serial Number", "Song Name", "Hebrew Date Folder", "Singer", "Copied Drive ID"
            reader = csv.DictReader(csvfile)

            # --- Header Validation ---
            header = reader.fieldnames
            required_keys = ['Serial Number', 'Song Name', 'Hebrew Date Folder', 'Singer', 'Copied Drive ID']

            if not header:
                print(f"Error: CSV file '{csv_filepath}' appears to be empty or has no header row.", file=sys.stderr)
                sys.exit(1)

            # Check if all required keys are present in the actual header
            missing_keys = [key for key in required_keys if key not in header]
            if missing_keys:
                print(f"Error: Input CSV file '{csv_filepath}' is missing required columns: {missing_keys}", file=sys.stderr)
                print(f"       Please ensure the CSV has these columns exactly (case-sensitive).", file=sys.stderr)
                print(f"       Actual header found in file: {header}", file=sys.stderr)
                # Output empty YAML in case of header mismatch to avoid partial/old data downstream? Or just exit? Let's exit.
                sys.exit(1)

            print(f"CSV Header validated successfully: {header}")

            # --- Row Processing ---
            for i, row in enumerate(reader):
                # Basic validation: Check if all required keys exist *and have some non-empty value*
                is_valid_row = True
                for key in required_keys:
                    # Check if the key exists (DictReader should ensure this if header is valid)
                    # and if the value associated with the key is not None and not just whitespace.
                    if key not in row or row[key] is None or not row[key].strip():
                        print(f"Warning: Skipping row {i+2} (data row index {i}) due to missing or empty value for required key '{key}'. Row data: {row}", file=sys.stderr)
                        is_valid_row = False
                        break # Stop checking this row

                if not is_valid_row:
                    continue # Skip to the next row

                # Map CSV columns to YAML fields
                try:
                    song = {
                        'serial': row['Serial Number'].strip(),
                        'name': row['Song Name'].strip(),
                        'album': row['Hebrew Date Folder'].strip(), # Mapping Hebrew Date Folder to 'album'
                        'singer': row['Singer'].strip(),
                        'driveId': row['Copied Drive ID'].strip()   # Mapping Copied Drive ID to 'driveId'
                    }
                    data.append(song)
                except KeyError as e:
                    # This shouldn't happen if header validation passed, but as a safeguard
                    print(f"Error: Unexpected missing key '{e}' while processing row {i+2}. Row data: {row}", file=sys.stderr)
                    # Decide whether to skip row or exit. Let's skip the row.
                    continue
                except Exception as row_err:
                    print(f"Error processing row {i+2}: {row_err}. Row data: {row}", file=sys.stderr)
                    continue # Skip problematic row


        # Check if any data was actually processed
        if not data:
             print(f"Warning: No valid data rows found or processed in '{csv_filepath}'. Output YAML will be empty.", file=sys.stderr)
             # Ensure an empty list is written if no data was appended
             # This prevents leaving an old YAML file unchanged if the new CSV is empty/invalid

        # Write data to YAML file, supporting Hebrew characters
        print(f"Processed {len(data)} valid rows from CSV. Writing to YAML file: {yaml_filepath}")
        try:
            with open(yaml_filepath, 'w', encoding='utf-8') as yamlfile:
                # Use default_flow_style=False for better readability (block style)
                yaml.dump(data, yamlfile, allow_unicode=True, sort_keys=False, default_flow_style=False)
            print(f"Successfully converted {csv_filepath} to {yaml_filepath}")
        except Exception as dump_err:
             print(f"Error writing data to YAML file {yaml_filepath}: {dump_err}", file=sys.stderr)
             sys.exit(1)

    except FileNotFoundError:
        # This specific error during open() is redundant due to the check at the start, but good practice.
        print(f"Error: CSV file not found at {csv_filepath} during conversion attempt.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred during CSV to YAML conversion: {e}", file=sys.stderr)
        print("Traceback:")
        traceback.print_exc(file=sys.stderr) # Print full traceback for unexpected errors
        sys.exit(1) # Signal error to the workflow

if __name__ == "__main__":
    # Setup argument parser (remains the same)
    parser = argparse.ArgumentParser(description='Convert a specific CSV format (handles potential BOM) to YAML for Jekyll.')
    parser.add_argument('--csv-input', required=True, help='Path to the input CSV file (e.g., drive_data/new-songs.csv or drive_data/all_songs.csv)')
    parser.add_argument('--yaml-output', required=True, help='Path to the output YAML file (e.g., docs/_data/new_songs.yml or docs/_data/all_songs.yml)')

    args = parser.parse_args()

    # Call the conversion function with parsed arguments
    convert_csv_to_yaml(args.csv_input, args.yaml_output)