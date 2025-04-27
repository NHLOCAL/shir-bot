# drive_data/drive_sync_inventory.py
# Optimized Sync Logic: Batch listing and local comparison

import os
import certifi
import time
import csv
import traceback
import json
import sys
from pathlib import Path

# Ensure the certificate bundle is used
os.environ['SSL_CERT_FILE'] = certifi.where()

# --- Google API Imports ---
try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print("Error: Required Google libraries not found.", file=sys.stderr)
    sys.exit(1)

# --- הגדרות (ללא שינוי) ---
SCOPES = ['https://www.googleapis.com/auth/drive']
SOURCE_ROOT_FOLDER_ID_GENERAL = "1sMGZLisLMAZKKeCVnkGREZbUW7aXst08"
TARGET_SUBFOLDER_GENERAL = "כללי"
SOURCE_ROOT_FOLDER_ID_CATEGORIZED_1 = "1wJCtZ04tSQw8UGdrmFNLUmfGf0tcMJ0r"
EXCLUDED_CATEGORIES_1 = ["מקהלות ותזמורות", "הופעות ואירועים", "מקבצי זמרים"]
SOURCE_ROOT_FOLDER_ID_CATEGORIZED_2 = "1YF029dYixoiJJfPwjndEWqIK_838KRXI"
EXCLUDED_CATEGORIES_2 = []
IGNORE_SINGERS_FILE = Path("drive_data/ignore_singers.txt")
TARGET_ROOT_FOLDER_ID = "1dfyehiuGrgj2B_76-9I-nJqJ3VOLP3v_"
SINGLES_FOLDER_NAME = "סינגלים"
MAX_FILES_TO_COPY_PER_RUN = 10000
CSV_OUTPUT_FILENAME = Path("drive_data/all_songs.csv")
YAML_OUTPUT_FILENAME = Path("docs/_data/all_songs.yml")
CSV_HEADER = ['Serial Number', 'Song Name', 'Hebrew Date Folder', 'Singer', 'Copied Drive ID']
# --- סוף הגדרות ---

# --- Authentication (ללא שינוי) ---
def authenticate_github_actions():
    # ... (Implementation remains the same) ...
    creds = None
    token_json_content = os.environ.get('GDRIVE_TOKEN_JSON_CONTENT')
    if not token_json_content: print("ERROR: GDRIVE_TOKEN_JSON_CONTENT env var not found.", file=sys.stderr); return None
    try:
        creds_info = json.loads(token_json_content)
        required_keys = ['client_id', 'client_secret', 'refresh_token', 'token_uri']
        if not all(key in creds_info for key in required_keys): print(f"ERROR: Token JSON missing keys.", file=sys.stderr); return None
        creds = Credentials.from_authorized_user_info(creds_info, SCOPES)
        if creds and creds.expired and creds.refresh_token:
            print("Token expired, attempting refresh..."); creds.refresh(Request()); print("Token refreshed.")
        elif not creds or not creds.valid: print("ERROR: Loaded credentials invalid.", file=sys.stderr); return None
        print("Authentication successful."); return creds
    except Exception as e: print(f"ERROR: Auth failed: {e}", file=sys.stderr); traceback.print_exc(file=sys.stderr); return None

# --- Helper Functions ---

def list_items(service, query, fields="nextPageToken, files(id, name, mimeType)", order_by=None, page_size=1000): # Increased page size
    """Helper to list files/folders with pagination, retries, and larger page size."""
    # ... (Implementation remains the same, but using page_size=1000 default) ...
    items = []
    page_token = None
    retries = 5 # Increased retries slightly for potentially larger lists
    delay = 1
    current_retry = 0
    while True:
        try:
            list_params = {
                'q': query, 'spaces': 'drive', 'fields': fields, 'pageToken': page_token,
                'pageSize': page_size, 'supportsAllDrives': True, 'includeItemsFromAllDrives': True
            }
            if order_by: list_params['orderBy'] = order_by
            response = service.files().list(**list_params).execute()
            items.extend(response.get('files', []))
            page_token = response.get('nextPageToken', None)
            if page_token is None: break
            current_retry = 0
        except HttpError as error:
            current_retry += 1
            print(f"API Error during list_items query='{query}': {error} (Attempt {current_retry}/{retries})", file=sys.stderr)
            status_code = getattr(error, 'resp', None) and getattr(error.resp, 'status', None)
            if status_code in [403, 429, 500, 502, 503, 504] and current_retry < retries:
                 print(f"Retryable error ({status_code}). Retrying in {delay}s...", file=sys.stderr)
                 time.sleep(delay * (current_retry)) # Slightly longer backoff
                 delay = min(delay * 1.5, 32) # Cap backoff
                 continue
            else:
                 print("Could not list items after retries or non-retryable error.", file=sys.stderr)
                 if status_code == 403: print("Permission error likely.", file=sys.stderr)
                 return None # Indicate failure clearly
        except Exception as e:
            print(f"Unexpected error during list_items query='{query}': {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            return None # Indicate failure
    return items

# NEW Helper Function to get folder content efficiently
def get_folder_content_map(service, folder_id):
    """
    Retrieves all items (files and folders) in a folder using efficient listing.
    Returns a dictionary mapping item name to its ID, or None on failure.
    Logs names but suppresses folder_id.
    """
    print(f"    Fetching content list for folder (ID hidden)...")
    query = f"'{folder_id}' in parents and trashed = false"
    # Request only id and name, as mimeType isn't needed for the map comparison
    items = list_items(service, query, fields="nextPageToken, files(id, name)")

    if items is None: # Check if list_items failed
        print(f"    Failed to list content for folder (ID: {folder_id})", file=sys.stderr)
        return None

    content_map = {item['name']: item['id'] for item in items if 'name' in item and 'id' in item}
    print(f"    Found {len(content_map)} items in folder (ID hidden).")
    return content_map

# get_or_create_folder (Slightly simplified use, main logic unchanged)
def get_or_create_folder(service, name, parent_id):
    # ... (Implementation remains the same, still needed for creating target structure) ...
    try:
        safe_name = name.replace("\\", "\\\\").replace("'", "\\'")
        query = f"'{parent_id}' in parents and name = '{safe_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        # Use the more robust list_items
        existing_folders_list = list_items(service, query, fields="files(id, name)", page_size=1)
        if existing_folders_list is None: return None # Handle list failure
        existing_folders = existing_folders_list # Rename for clarity

        if existing_folders:
            folder_id = existing_folders[0].get('id')
            print(f"  Found existing folder '{existing_folders[0].get('name')}' (Parent ID hidden)")
            return folder_id
        else:
            print(f"  Creating folder '{name}' (Parent ID hidden)...")
            folder_metadata = {'name': name, 'mimeType': 'application/vnd.google-apps.folder', 'parents': [parent_id]}
            retries = 3; delay = 1
            for i in range(retries):
                try:
                    folder = service.files().create(body=folder_metadata, fields='id, name', supportsAllDrives=True).execute()
                    folder_id = folder.get('id'); created_name = folder.get('name')
                    print(f"    Created folder '{created_name}' (ID hidden)")
                    return folder_id
                except HttpError as create_error:
                    print(f"    Attempt {i+1}/{retries} failed to create folder '{name}' under parent {parent_id}: {create_error}", file=sys.stderr)
                    status_code = getattr(create_error, 'resp', None) and getattr(create_error.resp, 'status', None)
                    if status_code in [403, 429, 500, 503] and i < retries - 1:
                        print(f"    Retrying folder creation in {delay}s...", file=sys.stderr); time.sleep(delay); delay *= 2; continue
                    else: print(f"    Failed to create folder '{name}'.", file=sys.stderr); return None
                except Exception as e_create: print(f"    Unexpected error creating folder '{name}': {e_create}", file=sys.stderr); return None
            return None
    except Exception as e: print(f"  Unexpected error in get_or_create_folder '{name}': {e}", file=sys.stderr); return None


# copy_file (No changes needed in its own logic)
def copy_file(service, source_file_id, file_name, target_parent_id):
    # ... (Implementation remains the same, logs updated previously) ...
    retries = 5; delay = 1.0
    for i in range(retries):
        try:
            print(f"    Attempting to copy '{file_name}' (Source ID hidden) to target folder (ID hidden) (Attempt {i+1}/{retries})...")
            copy_metadata = {'name': file_name, 'parents': [target_parent_id]}
            copied_file = service.files().copy(fileId=source_file_id, body=copy_metadata, fields='id, name', supportsAllDrives=True).execute()
            copy_id = copied_file.get('id')
            print(f"      Successfully copied '{copied_file.get('name')}' - New Copy ID hidden")
            return copy_id
        except HttpError as error:
            print(f"      Error copying file '{file_name}' (Source ID: {source_file_id}, Target Parent: {target_parent_id}): {error}", file=sys.stderr)
            status_code = getattr(error, 'resp', None) and getattr(error.resp, 'status', None)
            if status_code in [403, 404, 429, 500, 502, 503, 504] and i < retries - 1:
                if status_code == 404: print(f"      Source file {source_file_id} not found.", file=sys.stderr); return None
                if status_code == 403: print("      Permission/Rate Limit error (403).", file=sys.stderr)
                if status_code == 400 and 'invalid parents field' in str(error).lower(): print(f"      Invalid target parent {target_parent_id}.", file=sys.stderr); return None
                print(f"      Retryable error ({status_code}). Retrying in {delay:.2f}s...", file=sys.stderr)
                time.sleep(delay + (delay * i * 0.5) + (delay * 0.2 * (i+1))); delay = min(delay * 1.5, 32.0); continue
            else: print(f"      Could not copy file '{file_name}' (Source ID: {source_file_id}).", file=sys.stderr); return None
        except Exception as e: print(f"      Unexpected error copying '{file_name}' (Source ID: {source_file_id}): {e}", file=sys.stderr); return None
    print(f"      Copy failed for '{file_name}' (Source ID: {source_file_id}) after all retries.", file=sys.stderr); return None


# --- Load Ignored List Helper (ללא שינוי) ---
def load_ignored_list(filename_path):
    # ... (Implementation remains the same) ...
    ignored_set = set()
    if not filename_path.is_file(): print(f"Warning: Ignore file '{filename_path}' not found.", file=sys.stderr); return ignored_set
    try:
        with open(filename_path, 'r', encoding='utf-8') as f:
            for line in f: name = line.strip();
            if name and not name.startswith('#'): ignored_set.add(name)
        print(f"Loaded {len(ignored_set)} names to ignore from '{filename_path}'.")
    except Exception as e: print(f"Error reading ignore file '{filename_path}': {e}", file=sys.stderr)
    return ignored_set

# --- Sync Functions (OPTIMIZED) ---

# OPTIMIZED Recursive Copy
def copy_folder_recursively_optimized(service, source_folder_id, target_folder_id, copy_counters, limit_flag):
    """
    Recursively copies contents using optimized listing and comparison.
    Logs folder names but suppresses IDs.
    Assumes target_folder_id already exists.
    """
    if limit_flag[0]: return

    try:
        source_folder_info = service.files().get(fileId=source_folder_id, fields='name', supportsAllDrives=True).execute()
        source_folder_name = source_folder_info.get('name', 'UnknownFolder')
        # Suppress IDs in standard log
        print(f"  Syncing source folder (optimized): '{source_folder_name}' (ID hidden) -> target folder (ID hidden)")
    except HttpError as e:
        print(f"  Error getting source folder name for ID {source_folder_id}: {e}. Skipping recursive sync.", file=sys.stderr)
        return
    except Exception as e:
        print(f"  Unexpected error getting source folder info {source_folder_id}: {e}. Skipping.", file=sys.stderr)
        return

    # Get content maps for source and target
    source_content_map = get_folder_content_map(service, source_folder_id)
    target_content_map = get_folder_content_map(service, target_folder_id)

    # Handle cases where listing failed
    if source_content_map is None:
        print(f"  Failed to list source folder content (ID: {source_folder_id}). Skipping sync for this folder.", file=sys.stderr)
        return
    if target_content_map is None:
        print(f"  Failed to list target folder content (ID: {target_folder_id}). Skipping sync for this folder.", file=sys.stderr)
        return

    target_names_set = set(target_content_map.keys())

    # Process items from the source map
    for item_name, item_id in source_content_map.items():
        if limit_flag[0]:
            print(f"    Copy limit reached during sync of '{source_folder_name}'. Stopping sync here.")
            break

        # Determine if source item is likely a folder (heuristic: no file extension)
        # A more robust check would involve another API call or assumptions based on your naming conventions.
        # Let's assume for now things without common audio/video extensions are folders.
        # OR better: We need mimeType here. Let's adjust get_folder_content_map slightly
        # Correction: Need to list mimeType initially to differentiate.

        # --- Let's re-fetch with mimeType for differentiation ---
        print(f"    Fetching detailed content list for source folder (ID hidden)...")
        source_items_detailed = list_items(service, f"'{source_folder_id}' in parents and trashed=false", fields="nextPageToken, files(id, name, mimeType)")
        if source_items_detailed is None:
             print(f"  Failed to list detailed source folder content (ID: {source_folder_id}). Skipping sync.", file=sys.stderr)
             return
        # --- End Re-fetch ---


        # Process detailed source items
        for source_item in source_items_detailed:
             if limit_flag[0]: break

             item_id = source_item.get('id')
             item_name = source_item.get('name')
             item_mime_type = source_item.get('mimeType')
             if not item_id or not item_name: continue

             # --- Process FOLDER ---
             if item_mime_type == 'application/vnd.google-apps.folder':
                 target_subfolder_id = None
                 if item_name in target_names_set:
                     target_subfolder_id = target_content_map[item_name] # Get existing ID
                     print(f"    Found existing target subfolder: '{item_name}' (ID hidden)")
                 else:
                     print(f"    Target subfolder '{item_name}' missing. Creating...")
                     target_subfolder_id = get_or_create_folder(service, item_name, target_folder_id) # Create it

                 if target_subfolder_id:
                     # Recurse with the identified/created target subfolder ID
                     copy_folder_recursively_optimized(
                         service,
                         item_id, # Source subfolder ID
                         target_subfolder_id, # Target subfolder ID
                         copy_counters,
                         limit_flag
                     )
                 else:
                     print(f"      Failed to ensure target subfolder '{item_name}' exists under target {target_folder_id}. Skipping recursion.", file=sys.stderr)

             # --- Process FILE ---
             else: # It's a file
                 if item_name not in target_names_set: # File is missing in target
                     print(f"    File '{item_name}' missing in target. Attempting copy...")
                     # Check copy limit BEFORE attempting copy
                     if copy_counters['copied'][0] >= MAX_FILES_TO_COPY_PER_RUN:
                         print(f"\nReached copy limit ({MAX_FILES_TO_COPY_PER_RUN}). Stopping copies.")
                         limit_flag[0] = True
                         break # Stop processing items in this folder

                     copied_file_id = copy_file(service, item_id, item_name, target_folder_id) # Copy to current target
                     if copied_file_id:
                         copy_counters['copied'][0] += 1
                     else:
                         print(f"      Failed to copy file '{item_name}' (Source ID: {item_id}).", file=sys.stderr)
                     time.sleep(0.1)
                 # else: File exists, do nothing


# OPTIMIZED Sync for Categorized Source
def sync_categorized_source_optimized(service, source_root_id, source_description, target_root_id, singles_folder_name,
                                      excluded_categories, ignored_singers_set, copy_counters, limit_flag):
    """
    Syncs categorized source using optimized listing and comparison for the 'Singles' folders.
    Logs names but suppresses IDs.
    """
    print(f"\n--- Processing Categorized Source (Optimized): {source_description} (Source ID hidden) ---")
    print(f"Looking for category folders under source root (ID hidden)")
    source_category_query = f"'{source_root_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    source_category_folders = list_items(service, source_category_query, fields="files(id, name)", order_by="name")

    if source_category_folders is None: print("Failed to list source categories.", file=sys.stderr); return
    if not source_category_folders: print(f"No category folders found."); return
    print(f"Found {len(source_category_folders)} source category folders.")

    for category_folder in source_category_folders:
        if limit_flag[0]: break
        category_name = category_folder.get('name'); category_id = category_folder.get('id')
        if not category_name or not category_id: continue

        print(f"\n>>> Processing Source Category: '{category_name}' (ID hidden)")
        if category_name in excluded_categories: print(f"  Skipping excluded category '{category_name}'."); continue

        target_category_folder_id = get_or_create_folder(service, category_name, target_root_id)
        if not target_category_folder_id:
            print(f"  Failed to ensure target category folder '{category_name}'. Skipping category.", file=sys.stderr); continue

        source_artist_query = f"'{category_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        source_artist_folders = list_items(service, source_artist_query, fields="files(id, name)")
        if source_artist_folders is None: print(f"  Failed to list artists in '{category_name}'. Skipping.", file=sys.stderr); continue
        if not source_artist_folders: continue

        for artist_folder in source_artist_folders:
            if limit_flag[0]: break
            artist_name = artist_folder.get('name'); source_artist_folder_id = artist_folder.get('id')
            if not artist_name or not source_artist_folder_id: continue
            if any(ignored in artist_name for ignored in ignored_singers_set): print(f"      Skipping ignored artist '{artist_name}'."); continue

            # Find the source "Singles" subfolder ID efficiently
            singles_query = f"'{source_artist_folder_id}' in parents and name='{singles_folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
            source_singles_list = list_items(service, singles_query, fields="files(id)", page_size=1)
            if source_singles_list is None or not source_singles_list: continue # Skip if query fails or no singles folder
            source_singles_subfolder_id = source_singles_list[0].get('id')
            if not source_singles_subfolder_id: continue # Skip if ID missing

            print(f"      Found source '{singles_folder_name}' for '{artist_name}' (Source IDs hidden)")

            # Ensure target structure exists
            target_artist_folder_id = get_or_create_folder(service, artist_name, target_category_folder_id)
            if not target_artist_folder_id: print(f"       Failed to ensure target artist folder '{artist_name}'.", file=sys.stderr); continue
            target_singles_subfolder_id = get_or_create_folder(service, singles_folder_name, target_artist_folder_id)
            if not target_singles_subfolder_id: print(f"       Failed to ensure target singles folder for '{artist_name}'.", file=sys.stderr); continue

            # --- Optimized File Sync within Singles Folders ---
            print(f"        Syncing FILES for '{artist_name}/{singles_folder_name}' using optimized comparison...")
            source_files_map = get_folder_content_map(service, source_singles_subfolder_id) # Get source {name: id}
            target_files_map = get_folder_content_map(service, target_singles_subfolder_id) # Get target {name: id}

            if source_files_map is None or target_files_map is None:
                print(f"        Failed to get file lists for source/target singles folder of '{artist_name}'. Skipping sync.", file=sys.stderr)
                continue

            target_filenames_set = set(target_files_map.keys())
            files_to_copy = []
            for file_name, source_file_id in source_files_map.items():
                 # Assume items in singles folders are files (can refine if needed)
                 if file_name not in target_filenames_set:
                     files_to_copy.append({'id': source_file_id, 'name': file_name})

            print(f"        Found {len(files_to_copy)} files to copy for '{artist_name}'.")

            for file_info in files_to_copy:
                if limit_flag[0]:
                     print(f"        Copy limit reached for '{artist_name}'. Stopping further copies for this artist.")
                     break
                if copy_counters['copied'][0] >= MAX_FILES_TO_COPY_PER_RUN:
                    print(f"\nReached copy limit ({MAX_FILES_TO_COPY_PER_RUN}). Stopping all copies.")
                    limit_flag[0] = True; break

                copied_id = copy_file(service, file_info['id'], file_info['name'], target_singles_subfolder_id)
                if copied_id: copy_counters['copied'][0] += 1
                time.sleep(0.1)
            # --- End Optimized File Sync ---


# --- Inventory Function (ללא שינוי בלוגיקה הפנימית) ---
def inventory_target_folder(service, folder_id, csv_writer, serial_counter, current_path_str, parent_category):
    """Recursively scans target folder. Logs names but suppresses IDs. Writes CSV."""
    # ... (Implementation remains the same as previous version) ...
    query = f"'{folder_id}' in parents and trashed = false"
    # Need mimeType to differentiate files/folders for recursion
    items = list_items(service, query, fields="nextPageToken, files(id, name, mimeType)")
    if items is None: print(f"Inventory failed for folder {folder_id}", file=sys.stderr); return

    for item in items:
        item_id = item.get('id'); item_name = item.get('name'); item_mime_type = item.get('mimeType')
        if not item_id or not item_name: continue # Skip invalid items

        item_path_within_category = f"{current_path_str}/{item_name}" if current_path_str else item_name

        if item_mime_type == 'application/vnd.google-apps.folder':
            inventory_target_folder(service, item_id, csv_writer, serial_counter, item_path_within_category, parent_category)
        else: # File
            serial_counter[0] += 1
            song_name_for_csv, _ = os.path.splitext(item_name)
            relative_path = Path(item_path_within_category)
            parent_path_parts = list(relative_path.parent.parts)
            album_name = "Unknown Album"; singer_name = "Unknown Artist"
            if len(parent_path_parts) >= 1:
                singer_name = parent_path_parts[0]; album_name = parent_path_parts[-1]
                if len(parent_path_parts) == 1: album_name = singer_name
            else: album_name = parent_category; singer_name = parent_category
            csv_row = [serial_counter[0], song_name_for_csv, album_name, singer_name, item_id]
            try: csv_writer.writerow(csv_row)
            except Exception as csv_err: print(f"      Error writing CSV row for '{item_name}' (ID: {item_id}): {csv_err}", file=sys.stderr)


# --- Main Processing Function (Using Optimized Sync) ---
def run_sync_and_inventory():
    print("Starting Drive Sync and Inventory process (Optimized)...")
    creds = authenticate_github_actions()
    if not creds: print("Authentication failed. Exiting.", file=sys.stderr); sys.exit(1)

    ignored_singers = load_ignored_list(IGNORE_SINGERS_FILE)

    try:
        service = build('drive', 'v3', credentials=creds)
        print("Successfully authenticated and built Drive service.")

        copy_counters = {'copied': [0]}; copy_limit_reached = [False]
        print("\n--- Phase 1: Syncing Sources to Target (Optimized) ---")

        # --- Sync General Source ---
        print(f"\n--- Syncing General Source (Optimized) (ID hidden) -> '{TARGET_SUBFOLDER_GENERAL}' ---")
        target_general_folder_id = get_or_create_folder(service, TARGET_SUBFOLDER_GENERAL, TARGET_ROOT_FOLDER_ID)
        if not target_general_folder_id: print(f"FATAL: Could not ensure target subfolder '{TARGET_SUBFOLDER_GENERAL}'. Aborting.", file=sys.stderr); sys.exit(1)
        else: print(f"Target subfolder '{TARGET_SUBFOLDER_GENERAL}' confirmed/created (ID hidden)")

        source_general_top_query = f"'{SOURCE_ROOT_FOLDER_ID_GENERAL}' in parents and trashed = false"
        source_general_top_items = list_items(service, source_general_top_query, fields="files(id, name, mimeType)") # Get mimeType here

        if source_general_top_items is None: print("Failed to list general source items. Skipping.", file=sys.stderr)
        elif not source_general_top_items: print("No items found directly under general source root.")
        else:
            print(f"Processing {len(source_general_top_items)} top-level items from general source...")
            # Get target general folder content once for comparison of direct files
            target_general_content_map = get_folder_content_map(service, target_general_folder_id)
            if target_general_content_map is None:
                print(f"Failed to list target general folder content ({target_general_folder_id}). File existence checks might be skipped.", file=sys.stderr)
                target_general_filenames_set = set() # Assume empty if failed
            else:
                target_general_filenames_set = set(target_general_content_map.keys())


            for source_item in source_general_top_items:
                if copy_limit_reached[0]: break
                item_name = source_item.get('name'); item_id = source_item.get('id'); item_mime_type = source_item.get('mimeType')
                if not item_name or not item_id: continue
                print(f"\nProcessing General Item: '{item_name}' (ID hidden)")

                # Case 1: Source item is a FOLDER
                if item_mime_type == 'application/vnd.google-apps.folder':
                    # Artist Folder Structure (Needs "Singles" subfolder)
                    if SINGLES_FOLDER_NAME not in item_name:
                        print(f"  Folder '{item_name}': Checking for '{SINGLES_FOLDER_NAME}' subfolder.")
                        singles_query = f"'{item_id}' in parents and name='{singles_folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
                        source_singles_list = list_items(service, singles_query, fields="files(id)", page_size=1)

                        if source_singles_list is not None and source_singles_list:
                            source_singles_subfolder_id = source_singles_list[0].get('id')
                            if source_singles_subfolder_id:
                                target_artist_folder_id = get_or_create_folder(service, item_name, target_general_folder_id)
                                if target_artist_folder_id:
                                    target_singles_subfolder_id = get_or_create_folder(service, SINGLES_FOLDER_NAME, target_artist_folder_id)
                                    if target_singles_subfolder_id:
                                        # --- Optimized Sync for this specific Singles folder ---
                                        print(f"    Syncing FILES for '{item_name}/{SINGLES_FOLDER_NAME}' using optimized comparison...")
                                        source_files_map = get_folder_content_map(service, source_singles_subfolder_id)
                                        target_files_map = get_folder_content_map(service, target_singles_subfolder_id)
                                        if source_files_map is not None and target_files_map is not None:
                                            target_fnames_set = set(target_files_map.keys())
                                            files_to_copy = [{'id': src_id, 'name': fname} for fname, src_id in source_files_map.items() if fname not in target_fnames_set]
                                            print(f"    Found {len(files_to_copy)} files to copy.")
                                            for file_info in files_to_copy:
                                                if copy_limit_reached[0]: break
                                                if copy_counters['copied'][0] >= MAX_FILES_TO_COPY_PER_RUN: copy_limit_reached[0] = True; break
                                                copied_id = copy_file(service, file_info['id'], file_info['name'], target_singles_subfolder_id)
                                                if copied_id: copy_counters['copied'][0] += 1
                                                time.sleep(0.1)
                                        else: print(f"    Failed to get file lists for '{item_name}/{SINGLES_FOLDER_NAME}'. Skipping.", file=sys.stderr)
                                        # --- End Optimized Sync ---
                        else: print(f"    No '{SINGLES_FOLDER_NAME}' subfolder found or failed to query in '{item_name}'. Skipping.")
                    # Singles Collection Folder Structure (Recursive Sync)
                    elif SINGLES_FOLDER_NAME in item_name:
                        print(f"  Folder '{item_name}' (Singles Collection): Initiating RECURSIVE sync (optimized).")
                        # Ensure target collection folder exists
                        target_collection_folder_id = get_or_create_folder(service, item_name, target_general_folder_id)
                        if target_collection_folder_id:
                            copy_folder_recursively_optimized(
                                service, item_id, target_collection_folder_id, copy_counters, copy_limit_reached
                            )
                        else: print(f"    Failed to ensure target folder '{item_name}' under '{TARGET_SUBFOLDER_GENERAL}'. Skipping.", file=sys.stderr)
                    else: print(f"  Folder '{item_name}' type unclear. Skipping.")

                # Case 2: Source item is a FILE directly under general source root
                else: # It's a file
                     print(f"  File '{item_name}': Checking existence in '{TARGET_SUBFOLDER_GENERAL}'...")
                     # Use the pre-fetched target content for direct file check
                     if item_name not in target_general_filenames_set:
                         print(f"    File '{item_name}' missing. Copying...")
                         if copy_counters['copied'][0] >= MAX_FILES_TO_COPY_PER_RUN:
                             print(f"\nReached copy limit ({MAX_FILES_TO_COPY_PER_RUN}). Stopping."); copy_limit_reached[0] = True ; break
                         copied_id = copy_file(service, item_id, item_name, target_general_folder_id)
                         if copied_id: copy_counters['copied'][0] += 1
                         time.sleep(0.1)
                     # else: File exists, do nothing.

        # --- Sync Categorized Sources (Using Optimized Functions) ---
        if not copy_limit_reached[0]:
            sync_categorized_source_optimized(service, SOURCE_ROOT_FOLDER_ID_CATEGORIZED_1, "Categorized Music 1", TARGET_ROOT_FOLDER_ID, SINGLES_FOLDER_NAME, EXCLUDED_CATEGORIES_1, ignored_singers, copy_counters, copy_limit_reached)
        if not copy_limit_reached[0]:
            sync_categorized_source_optimized(service, SOURCE_ROOT_FOLDER_ID_CATEGORIZED_2, "Categorized Music 2", TARGET_ROOT_FOLDER_ID, SINGLES_FOLDER_NAME, EXCLUDED_CATEGORIES_2, ignored_singers, copy_counters, copy_limit_reached)

        print(f"\n--- Phase 1 Summary: {copy_counters['copied'][0]} files copied. Limit reached: {copy_limit_reached[0]} ---")

        # --- Phase 2: Inventory (No changes needed here) ---
        print(f"\n--- Phase 2: Generating Inventory CSV: '{CSV_OUTPUT_FILENAME}' ---")
        inventory_serial_counter = [0]
        CSV_OUTPUT_FILENAME.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(CSV_OUTPUT_FILENAME, 'w', newline='', encoding='utf-8-sig') as csvfile:
                csv_writer = csv.writer(csvfile); csv_writer.writerow(CSV_HEADER)
                print(f"Scanning top-level categories in target root (ID hidden)...")
                target_top_level_query = f"'{TARGET_ROOT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
                target_category_folders = list_items(service, target_top_level_query, fields="files(id, name)")
                if target_category_folders is None: print("Failed to list target categories.", file=sys.stderr)
                elif not target_category_folders: print("No category folders found in target.")
                else:
                    print(f"Found {len(target_category_folders)} target categories. Scanning each...")
                    for target_category in target_category_folders:
                        category_id = target_category.get('id'); category_name = target_category.get('name')
                        if not category_id or not category_name: continue
                        print(f"\nScanning category: '{category_name}' (ID hidden)")
                        inventory_target_folder(service, category_id, csv_writer, inventory_serial_counter, "", category_name)
                print(f"\nInventory complete. Found {inventory_serial_counter[0]} files. CSV saved to '{CSV_OUTPUT_FILENAME}'.")
        except IOError as e: print(f"FATAL: Error writing inventory CSV '{CSV_OUTPUT_FILENAME}': {e}", file=sys.stderr); sys.exit(1)
        except Exception as e: print(f"FATAL: Unexpected error during inventory: {e}", file=sys.stderr); traceback.print_exc(file=sys.stderr); sys.exit(1)

        print("\n--- Sync and Inventory Script Finished Successfully (Optimized) ---")

    # --- Error Handling (Remains the same) ---
    except HttpError as error: print(f'\nFATAL: An API error occurred: {error}', file=sys.stderr); traceback.print_exc(file=sys.stderr); sys.exit(1)
    except Exception as e: print(f"\nFATAL: An unexpected general error occurred: {e}", file=sys.stderr); traceback.print_exc(file=sys.stderr); sys.exit(1)


if __name__ == '__main__':
    run_sync_and_inventory()