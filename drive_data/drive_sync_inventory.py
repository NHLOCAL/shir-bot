# drive_data/drive_sync_inventory.py
# Updated: Refactored sync logic for efficiency, renamed file, changed CSV output name, suppressed IDs in standard logs.

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
    print("Error: Required Google libraries not found. Please install them via pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib")
    sys.exit(1)

# --- הגדרות ---
SCOPES = ['https://www.googleapis.com/auth/drive']

# --- Source Folders & Exclusions (Keep your specific IDs here) ---
SOURCE_ROOT_FOLDER_ID_GENERAL = "1sMGZLisLMAZKKeCVnkGREZbUW7aXst08"
TARGET_SUBFOLDER_GENERAL = "כללי"
SOURCE_ROOT_FOLDER_ID_CATEGORIZED_1 = "1wJCtZ04tSQw8UGdrmFNLUmfGf0tcMJ0r"
EXCLUDED_CATEGORIES_1 = ["מקהלות ותזמורות", "הופעות ואירועים", "מקבצי זמרים"]
SOURCE_ROOT_FOLDER_ID_CATEGORIZED_2 = "1YF029dYixoiJJfPwjndEWqIK_838KRXI"
EXCLUDED_CATEGORIES_2 = []

# --- Singer Ignore List ---
IGNORE_SINGERS_FILE = Path("drive_data/ignore_singers.txt")

# --- Target & Common ---
TARGET_ROOT_FOLDER_ID = "1dfyehiuGrgj2B_76-9I-nJqJ3VOLP3v_"
SINGLES_FOLDER_NAME = "סינגלים"
MAX_FILES_TO_COPY_PER_RUN = 50000

# --- Output File Paths (Relative to Repo Root) ---
# UPDATED CSV FILENAME
CSV_OUTPUT_FILENAME = Path("drive_data/all_songs.csv")
YAML_OUTPUT_FILENAME = Path("docs/_data/all_songs.yml") # Matches CSV name base

# --- CSV Header (MUST MATCH csv_to_yaml_converter.py expectations) ---
CSV_HEADER = ['Serial Number', 'Song Name', 'Hebrew Date Folder', 'Singer', 'Copied Drive ID']
# --- סוף הגדרות ---

# --- Authentication (authenticate_github_actions remains the same) ---
def authenticate_github_actions():
    """
    Authenticates using credentials loaded from the GDRIVE_TOKEN_JSON_CONTENT
    environment variable (populated by GitHub Secrets).
    """
    creds = None
    token_json_content = os.environ.get('GDRIVE_TOKEN_JSON_CONTENT')

    if not token_json_content:
        print("ERROR: GDRIVE_TOKEN_JSON_CONTENT environment variable not found.", file=sys.stderr)
        print("Ensure the correct secret (e.g., GDRIVE_TOKEN_JSON or GDRIVE_TOKEN_SYNC_INVENTORY) is set in GitHub repository settings.", file=sys.stderr)
        return None

    try:
        creds_info = json.loads(token_json_content)
        required_keys = ['client_id', 'client_secret', 'refresh_token', 'token_uri']
        if not all(key in creds_info for key in required_keys):
             print(f"ERROR: Token JSON is missing required keys. Found: {list(creds_info.keys())}. Need at least: {required_keys}", file=sys.stderr)
             return None

        creds = Credentials.from_authorized_user_info(creds_info, SCOPES)

        if creds and creds.expired and creds.refresh_token:
            print("Token expired, attempting refresh...")
            try:
                creds.refresh(Request())
                print("Token refreshed successfully.")
            except Exception as e:
                print(f"ERROR: Failed to refresh token: {e}", file=sys.stderr)
                print("Check if the refresh token is still valid or if OAuth consent was revoked.", file=sys.stderr)
                return None
        elif not creds or not creds.valid:
             print("ERROR: Loaded credentials are not valid and could not be refreshed.", file=sys.stderr)
             return None

        print("Authentication successful using provided token.")
        return creds

    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to decode JSON from GDRIVE_TOKEN_JSON_CONTENT: {e}", file=sys.stderr)
        print("Ensure the secret contains valid JSON.", file=sys.stderr)
        return None
    except Exception as e:
        print(f"ERROR: An unexpected error occurred during authentication: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return None


# --- Helper Functions ---
def list_items(service, query, fields="nextPageToken, files(id, name, mimeType)", order_by=None, page_size=1000):
    """Lists items matching the query, handling pagination and retries."""
    items = []
    page_token = None
    retries = 3
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
            time.sleep(0.1) # Small delay between pages
        except HttpError as error:
            current_retry += 1
            # Keep ID in error logs for debugging
            print(f"An error occurred during list_items query='{query}': {error} (Attempt {current_retry}/{retries})", file=sys.stderr)
            status_code = getattr(error, 'resp', None) and getattr(error.resp, 'status', None)
            if status_code in [403, 429, 500, 502, 503, 504] and current_retry < retries:
                 print(f"Retryable error ({status_code}). Retrying in {delay} seconds...", file=sys.stderr)
                 time.sleep(delay)
                 delay *= 2
                 continue
            else:
                 print("Could not list items after retries or non-retryable error.", file=sys.stderr)
                 if status_code == 403: print("Permission error likely.", file=sys.stderr)
                 return None # Indicate failure
        except Exception as e:
            print(f"An unexpected error occurred during list_items query='{query}': {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            return None # Indicate failure
    return items

# --- Helper Functions (get_or_create_folder, copy_file - Updated Logs) ---
def get_or_create_folder(service, name, parent_id):
    """
    Checks/Creates a folder. Logs folder names but suppresses parent_id in standard logs.
    Returns folder ID or None.
    """
    try:
        safe_name = name.replace("\\", "\\\\").replace("'", "\\'")
        # Keep parent_id in query, but don't log it routinely
        query = f"'{parent_id}' in parents and name = '{safe_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        # Request only 'id' and 'name' for efficiency
        existing_folders = list_items(service, query, fields="files(id, name)", page_size=1)

        if existing_folders is None: # list_items failed
            print(f"  Failed to query for existing folder '{name}' due to API error.", file=sys.stderr)
            return None

        if existing_folders:
            folder_id = existing_folders[0].get('id')
            # Suppress parent_id in standard log
            # print(f"  Found existing folder '{existing_folders[0].get('name')}' (Parent ID hidden)") # Reduce noise
            return folder_id
        else:
            # Suppress parent_id in standard log
            print(f"  Creating folder '{name}' (Parent ID hidden)...")
            folder_metadata = {'name': name, 'mimeType': 'application/vnd.google-apps.folder', 'parents': [parent_id]}
            retries = 3
            delay = 1
            for i in range(retries):
                try:
                    folder = service.files().create(body=folder_metadata, fields='id, name', supportsAllDrives=True).execute()
                    folder_id = folder.get('id')
                    created_name = folder.get('name')
                    # Suppress folder_id in standard log
                    print(f"    Created folder '{created_name}' (ID hidden)")
                    return folder_id
                except HttpError as create_error:
                    # Keep name and parent_id in error log for debugging
                    print(f"    Attempt {i+1}/{retries} failed to create folder '{name}' under parent {parent_id}: {create_error}", file=sys.stderr)
                    status_code = getattr(create_error, 'resp', None) and getattr(create_error.resp, 'status', None)
                    if status_code in [403, 429, 500, 503] and i < retries - 1:
                        print(f"    Retrying folder creation in {delay}s...", file=sys.stderr)
                        time.sleep(delay); delay *= 2; continue
                    else:
                        print(f"    Failed to create folder '{name}' after retries or non-retryable error.", file=sys.stderr)
                        return None
                except Exception as e_create:
                     # Keep name and parent_id in error log
                     print(f"    Unexpected error creating folder '{name}' under parent {parent_id} (Attempt {i+1}): {e_create}", file=sys.stderr)
                     return None
            return None
    except Exception as e:
        # Keep name and parent_id in error log
        print(f"  An unexpected error in get_or_create_folder for '{name}' under parent {parent_id}: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return None

def copy_file(service, source_file_id, file_name, target_parent_id):
    """
    Copies a file. Logs file names but suppresses IDs in standard logs.
    Returns new copy ID or None.
    """
    retries = 5
    delay = 1.0
    for i in range(retries):
        try:
            # Suppress IDs in standard log
            print(f"    Attempting to copy '{file_name}' (Source ID hidden) to target folder (ID hidden) (Attempt {i+1}/{retries})...")
            copy_metadata = {'name': file_name, 'parents': [target_parent_id]}
            copied_file = service.files().copy(fileId=source_file_id, body=copy_metadata, fields='id, name', supportsAllDrives=True).execute()
            copy_id = copied_file.get('id')
            # Suppress copy_id in standard log
            # print(f"      Successfully copied '{copied_file.get('name')}' - New Copy ID hidden") # Reduce noise
            return copy_id
        except HttpError as error:
            # Keep IDs in error log for debugging
            print(f"      Error copying file '{file_name}' (Source ID: {source_file_id}, Target Parent: {target_parent_id}): {error}", file=sys.stderr)
            status_code = getattr(error, 'resp', None) and getattr(error.resp, 'status', None)
            if status_code in [403, 404, 429, 500, 502, 503, 504] and i < retries - 1:
                if status_code == 404:
                    print(f"      Source file ID {source_file_id} not found. Cannot copy.", file=sys.stderr); return None
                if status_code == 403:
                    print("      Permission or Rate Limit error (403).", file=sys.stderr)
                if status_code == 400 and 'invalid parents field' in str(error).lower():
                     print(f"      Invalid target parent folder ID '{target_parent_id}'. Cannot copy.", file=sys.stderr); return None
                print(f"      Retryable error ({status_code}). Retrying in {delay:.2f} seconds...", file=sys.stderr)
                # Exponential backoff with jitter
                time.sleep(delay + (delay * i * 0.5) + (delay * 0.2 * (i+1)))
                delay = min(delay * 1.5, 32.0)
                continue
            else:
                print(f"      Could not copy file '{file_name}' (Source ID: {source_file_id}) after {i+1} attempts or non-retryable error.", file=sys.stderr)
                return None
        except Exception as e:
            # Keep IDs in error log
            print(f"      Unexpected error during copy of '{file_name}' (Source ID: {source_file_id}): {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            return None
    print(f"      Copy failed for '{file_name}' (Source ID: {source_file_id}) after all retries.", file=sys.stderr)
    return None

# --- Load Ignored List Helper (No changes needed) ---
def load_ignored_list(filename_path):
    ignored_set = set()
    if not filename_path.is_file():
        print(f"Warning: Ignore file '{filename_path}' not found.", file=sys.stderr)
        return ignored_set
    try:
        with open(filename_path, 'r', encoding='utf-8') as f:
            for line in f:
                name = line.strip()
                if name and not name.startswith('#'):
                    ignored_set.add(name)
        print(f"Loaded {len(ignored_set)} names to ignore from '{filename_path}'.")
    except Exception as e:
        print(f"Error reading ignore file '{filename_path}': {e}", file=sys.stderr)
    return ignored_set

# --- Optimized Sync Functions ---

def sync_files_between_folders(service, source_folder_id, target_folder_id, copy_counters, limit_flag):
    """
    Efficiently syncs files from source to target folder.
    Fetches lists of files from both, compares locally, and copies only missing files.
    """
    if limit_flag[0]: return

    print(f"      Listing files in source folder (ID hidden)...")
    source_files_query = f"'{source_folder_id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false"
    source_items = list_items(service, source_files_query, fields="files(id, name)")
    if source_items is None:
        print(f"      Failed to list source files in {source_folder_id}. Skipping sync for this folder pair.", file=sys.stderr)
        return

    print(f"      Listing files in target folder (ID hidden)...")
    target_files_query = f"'{target_folder_id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false"
    target_items = list_items(service, target_files_query, fields="files(name)") # Only need names for target check
    if target_items is None:
        print(f"      Failed to list target files in {target_folder_id}. Skipping sync for this folder pair.", file=sys.stderr)
        return

    source_files_map = {item['name']: item['id'] for item in source_items if 'name' in item and 'id' in item}
    target_file_names = {item['name'] for item in target_items if 'name' in item}

    files_to_copy_count = 0
    files_to_copy_list = []
    for file_name, source_file_id in source_files_map.items():
        if limit_flag[0]: break
        if file_name not in target_file_names:
            if copy_counters['copied'][0] >= MAX_FILES_TO_COPY_PER_RUN:
                print(f"\nReached copy limit ({MAX_FILES_TO_COPY_PER_RUN}). Stopping further checks in this folder.")
                limit_flag[0] = True
                break
            files_to_copy_count += 1
            files_to_copy_list.append({'id': source_file_id, 'name': file_name})

    if files_to_copy_count > 0:
        print(f"      Found {files_to_copy_count} files to copy from source (ID hidden) to target (ID hidden).")
        for file_info in files_to_copy_list:
            if limit_flag[0]: break
            copied_id = copy_file(service, file_info['id'], file_info['name'], target_folder_id)
            if copied_id:
                copy_counters['copied'][0] += 1
                # Add the newly copied file name to the target set to avoid re-copying if script runs again before inventory
                target_file_names.add(file_info['name'])
            else:
                 print(f"      Failed to copy file '{file_info['name']}' (Source ID: {file_info['id']}).", file=sys.stderr)
            time.sleep(0.1) # Keep small delay between copy operations
    # else: # Reduce noise
    #     print(f"      No new files to copy for this folder pair.")


def copy_folder_recursively_optimized(service, source_folder_id, target_parent_id, copy_counters, limit_flag):
    """
    Recursively syncs folder structure and files using the optimized list-and-compare approach.
    Logs folder names but suppresses IDs.
    """
    if limit_flag[0]: return

    try:
        source_folder_info = service.files().get(fileId=source_folder_id, fields='name', supportsAllDrives=True).execute()
        source_folder_name = source_folder_info.get('name', f'UnknownSourceFolder_{source_folder_id}')
    except HttpError as e:
        print(f"  Error getting source folder name for ID {source_folder_id}: {e}. Skipping recursive sync.", file=sys.stderr)
        return
    except Exception as e:
        print(f"  Unexpected error getting source folder info {source_folder_id}: {e}. Skipping.", file=sys.stderr)
        return

    # Suppress IDs in standard log
    print(f"\n  Syncing recursively: '{source_folder_name}' (ID hidden) -> target parent (ID hidden)")

    # 1. List items in source and target
    print(f"    Listing items in source '{source_folder_name}' (ID hidden)...")
    source_query = f"'{source_folder_id}' in parents and trashed = false"
    source_items = list_items(service, source_query, fields="files(id, name, mimeType)")
    if source_items is None:
        print(f"    Failed to list source items in {source_folder_name} ({source_folder_id}). Aborting sync for this branch.", file=sys.stderr)
        return

    print(f"    Listing items in target parent (ID hidden)...")
    target_query = f"'{target_parent_id}' in parents and trashed = false"
    target_items = list_items(service, target_query, fields="files(id, name, mimeType)")
    if target_items is None:
        print(f"    Failed to list target items in parent {target_parent_id}. Aborting sync for this branch.", file=sys.stderr)
        return

    # 2. Create lookups
    source_files = {item['name']: item['id'] for item in source_items if item.get('mimeType') != 'application/vnd.google-apps.folder' and 'name' in item and 'id' in item}
    source_folders = {item['name']: item['id'] for item in source_items if item.get('mimeType') == 'application/vnd.google-apps.folder' and 'name' in item and 'id' in item}
    target_files = {item['name'] for item in target_items if item.get('mimeType') != 'application/vnd.google-apps.folder' and 'name' in item}
    target_folders = {item['name']: item['id'] for item in target_items if item.get('mimeType') == 'application/vnd.google-apps.folder' and 'name' in item and 'id' in item}

    # 3. Process Folders (Recursively)
    print(f"    Processing {len(source_folders)} subfolders found in '{source_folder_name}'...")
    for folder_name, source_subfolder_id in source_folders.items():
        if limit_flag[0]: break
        target_subfolder_id = None
        if folder_name in target_folders:
            target_subfolder_id = target_folders[folder_name]
            # print(f"      Found existing target subfolder '{folder_name}'") # Reduce noise
        else:
            print(f"      Target subfolder '{folder_name}' missing, creating...")
            target_subfolder_id = get_or_create_folder(service, folder_name, target_parent_id)

        if target_subfolder_id:
            # Recursive call
            copy_folder_recursively_optimized(service, source_subfolder_id, target_subfolder_id, copy_counters, limit_flag)
        else:
            print(f"      Failed to get/create target subfolder '{folder_name}' under parent {target_parent_id}. Skipping sync for this branch.", file=sys.stderr)

    # 4. Process Files (Optimized Sync)
    print(f"    Processing {len(source_files)} files found in '{source_folder_name}'...")
    files_to_copy_list = []
    for file_name, source_file_id in source_files.items():
        if limit_flag[0]: break
        if file_name not in target_files:
             if copy_counters['copied'][0] >= MAX_FILES_TO_COPY_PER_RUN:
                 print(f"\nReached copy limit ({MAX_FILES_TO_COPY_PER_RUN}). Stopping further checks.")
                 limit_flag[0] = True
                 break
             files_to_copy_list.append({'id': source_file_id, 'name': file_name})

    if files_to_copy_list:
        print(f"      Found {len(files_to_copy_list)} files to copy in '{source_folder_name}'...")
        for file_info in files_to_copy_list:
             if limit_flag[0]: break
             copied_id = copy_file(service, file_info['id'], file_info['name'], target_parent_id)
             if copied_id:
                 copy_counters['copied'][0] += 1
                 # Add to target set to prevent potential duplicates if script runs quickly again
                 target_files.add(file_info['name'])
             else:
                 print(f"      Failed to copy file '{file_info['name']}' (Source ID: {file_info['id']}) into target {target_parent_id}.", file=sys.stderr)
             time.sleep(0.1)


def sync_categorized_source(service, source_root_id, source_description, target_root_id, singles_folder_name,
                            excluded_categories, ignored_singers_set, copy_counters, limit_flag):
    """
    Syncs categorized source using optimized file checking. Logs names but suppresses IDs.
    """
    # Suppress source_root_id
    print(f"\n--- Processing Categorized Source: {source_description} (Source ID hidden) ---")
    # Suppress source_root_id
    print(f"Looking for category folders under source root (ID hidden)")
    source_category_query = f"'{source_root_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    source_category_folders = list_items(service, source_category_query, fields="files(id, name)", order_by="name")

    if source_category_folders is None:
        print(f"Failed to list source category folders for {source_description}. Skipping.", file=sys.stderr)
        return
    if not source_category_folders:
        print(f"No category folders found under the source root for {source_description}.")
        return
    print(f"Found {len(source_category_folders)} source category folders in {source_description}.")

    for category_folder in source_category_folders:
        if limit_flag[0]: break
        category_name = category_folder.get('name'); category_id = category_folder.get('id')
        if not category_name or not category_id: continue

        # Suppress category_id
        print(f"\n>>> Processing Source Category: '{category_name}' (ID hidden) from {source_description}")
        if category_name in excluded_categories: print(f"  Skipping excluded category '{category_name}'."); continue

        # Suppress target_root_id
        target_category_folder_id = get_or_create_folder(service, category_name, target_root_id) # Log inside suppresses ID
        if not target_category_folder_id:
            # Keep name and target_root_id in error log
            print(f"  Failed to get/create target category folder '{category_name}' under target root {target_root_id}. Skipping category.", file=sys.stderr)
            continue

        source_artist_query = f"'{category_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        source_artist_folders = list_items(service, source_artist_query, fields="files(id, name)")
        if source_artist_folders is None:
            print(f"  Failed to list artist folders in category '{category_name}' ({category_id}). Skipping category.", file=sys.stderr)
            continue
        if not source_artist_folders:
            # print(f"  No artist folders found in category '{category_name}'.") # Reduce noise
            continue

        print(f"  Processing {len(source_artist_folders)} artist folders in '{category_name}'...")
        for artist_folder in source_artist_folders:
            if limit_flag[0]: break
            artist_name = artist_folder.get('name'); source_artist_folder_id = artist_folder.get('id')
            if not artist_name or not source_artist_folder_id: continue

            artist_ignored = any(ignored_name in artist_name for ignored_name in ignored_singers_set)
            if artist_ignored: print(f"    Skipping ignored artist folder '{artist_name}'."); continue

            # Look for the specific "singles" subfolder in the source artist folder
            singles_subfolder_query = f"'{source_artist_folder_id}' in parents and name = '{singles_folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
            found_singles_subfolders = list_items(service, singles_subfolder_query, fields="files(id)", page_size=1)

            if found_singles_subfolders is None:
                 print(f"    Failed query for '{singles_folder_name}' in '{artist_name}' ({source_artist_folder_id}). Skipping artist.", file=sys.stderr)
                 continue
            if not found_singles_subfolders:
                 # print(f"    No '{singles_folder_name}' subfolder found for artist '{artist_name}'.") # Reduce noise
                 continue

            source_singles_subfolder_id = found_singles_subfolders[0].get('id')
            if not source_singles_subfolder_id: continue # Should not happen if list_items worked

            # Suppress IDs in standard log
            print(f"    Found source '{singles_folder_name}' for '{artist_name}' (Source Artist/Singles IDs hidden)")

            # Ensure corresponding target structure exists
            target_artist_folder_id = get_or_create_folder(service, artist_name, target_category_folder_id) # Log inside suppresses ID
            if not target_artist_folder_id:
                print(f"    Failed to get/create target artist folder '{artist_name}'. Skipping artist.", file=sys.stderr)
                continue
            target_singles_subfolder_id = get_or_create_folder(service, singles_folder_name, target_artist_folder_id) # Log inside suppresses ID
            if not target_singles_subfolder_id:
                 print(f"    Failed to get/create target singles folder for '{artist_name}'. Skipping artist.", file=sys.stderr)
                 continue

            # Perform the efficient file sync between the source and target singles folders
            print(f"      Syncing files between source/target '{singles_folder_name}' folders for '{artist_name}'...")
            sync_files_between_folders(service, source_singles_subfolder_id, target_singles_subfolder_id, copy_counters, limit_flag)


# --- Recursive Inventory Function (Updated Logs - No functional change needed here) ---
def inventory_target_folder(service, folder_id, csv_writer, serial_counter, current_path_str, parent_category):
    """
    Recursively scans target folder. Logs names but suppresses IDs. Writes CSV.
    """
    query = f"'{folder_id}' in parents and trashed = false"
    items = list_items(service, query, fields="nextPageToken, files(id, name, mimeType)")
    if items is None:
        print(f"    Failed to list items during inventory in folder {folder_id} (Category: {parent_category}). Skipping this folder.", file=sys.stderr)
        return

    for item in items:
        item_id = item.get('id'); item_name = item.get('name'); item_mime_type = item.get('mimeType')
        if not item_id or not item_name:
            # Keep folder_id in error log
            print(f"    Skipping item with missing ID/name during inventory in folder {folder_id} (Category: {parent_category})", file=sys.stderr)
            continue

        item_path_within_category = f"{current_path_str}/{item_name}" if current_path_str else item_name

        if item_mime_type == 'application/vnd.google-apps.folder':
            inventory_target_folder(service, item_id, csv_writer, serial_counter, item_path_within_category, parent_category)
        else: # File
            serial_counter[0] += 1
            song_name_for_csv, _ = os.path.splitext(item_name)
            relative_path = Path(item_path_within_category)
            parent_path_parts = list(relative_path.parent.parts)
            album_name = "Unknown Album"; singer_name = "Unknown Artist"
            # Determine Singer/Album based on path within the Category
            if len(parent_path_parts) >= 1:
                singer_name = parent_path_parts[0] # First level under category is singer
                if len(parent_path_parts) > 1:
                     album_name = parent_path_parts[-1] # Last level is album (e.g., 'סינגלים')
                     if album_name == singer_name and len(parent_path_parts) > 1 : # Handle cases like "כללי/SingerName/Song.mp3"
                        album_name = parent_path_parts[-2] if len(parent_path_parts) > 1 else parent_category # Go up one more if possible
                else: # Only one level e.g. Category/SingerName/Song.mp3
                     album_name = singer_name # Or potentially parent_category? Let's use singer name.
            else: # File directly under Category? Should be rare with current structure.
                 album_name = parent_category
                 singer_name = parent_category


            # --- Write CSV Row - item_id is the value for 'Copied Drive ID' column ---
            csv_row = [serial_counter[0], song_name_for_csv, album_name, singer_name, item_id]
            try:
                csv_writer.writerow(csv_row)
            except Exception as csv_err:
                # Keep item_id in error log
                print(f"      Error writing CSV row for '{item_name}' (ID: {item_id}, Category: {parent_category}): {csv_err}", file=sys.stderr)

# --- Main Processing Function (Updated Logs & Logic) ---
def run_sync_and_inventory():
    print("Starting Drive Sync and Inventory process...")
    creds = authenticate_github_actions()
    if not creds: print("Authentication failed. Exiting.", file=sys.stderr); sys.exit(1)

    ignored_singers = load_ignored_list(IGNORE_SINGERS_FILE)

    try:
        service = build('drive', 'v3', credentials=creds, cache_discovery=False) # Disable discovery cache for potential issues
        print("Successfully authenticated and built Drive service.")

        copy_counters = {'copied': [0]}; copy_limit_reached = [False]
        print("\n--- Phase 1: Syncing Sources to Target (Optimized) ---")

        # --- Sync General Source ---
        print(f"\n--- Syncing General Source (ID hidden) -> '{TARGET_SUBFOLDER_GENERAL}' ---")
        target_general_folder_id = get_or_create_folder(service, TARGET_SUBFOLDER_GENERAL, TARGET_ROOT_FOLDER_ID)
        if not target_general_folder_id:
            print(f"FATAL: Could not get/create target subfolder '{TARGET_SUBFOLDER_GENERAL}' under root {TARGET_ROOT_FOLDER_ID}. Aborting.", file=sys.stderr)
            sys.exit(1)
        else:
            print(f"Target subfolder '{TARGET_SUBFOLDER_GENERAL}' confirmed/created (ID hidden)")

            # List top-level items in the general source
            source_general_top_query = f"'{SOURCE_ROOT_FOLDER_ID_GENERAL}' in parents and trashed = false"
            source_general_top_items = list_items(service, source_general_top_query, fields="files(id, name, mimeType)", order_by="name")

            if source_general_top_items is None:
                 print("Failed to list items from general source root. Skipping general sync.", file=sys.stderr)
            elif not source_general_top_items:
                 print("No items found directly under general source root.")
            else:
                print(f"Processing {len(source_general_top_items)} top-level items from general source...")
                # List target direct files ONCE for comparison
                print(f"  Listing existing files directly under '{TARGET_SUBFOLDER_GENERAL}' (ID hidden)...")
                target_general_files_query = f"'{target_general_folder_id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false"
                target_general_items = list_items(service, target_general_files_query, fields="files(name)")
                target_general_files_names = {item['name'] for item in target_general_items} if target_general_items else set()
                print(f"  Found {len(target_general_files_names)} existing files in target.")

                files_to_copy_direct = []

                for source_item in source_general_top_items:
                    if copy_limit_reached[0]: break
                    item_name = source_item.get('name'); item_id = source_item.get('id'); item_mime_type = source_item.get('mimeType')
                    if not item_name or not item_id: continue

                    print(f"\nProcessing General Item: '{item_name}' (Type: {item_mime_type}, ID hidden)")

                    if item_mime_type == 'application/vnd.google-apps.folder':
                        # Case 1: Folder potentially containing 'סינגלים' (Artist-like folder)
                        if SINGLES_FOLDER_NAME not in item_name: # Heuristic: if name doesn't contain 'singles', treat as artist folder
                            print(f"  Folder '{item_name}': Checking for '{SINGLES_FOLDER_NAME}' subfolder.")
                            singles_subfolder_query = f"'{item_id}' in parents and name = '{SINGLES_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
                            found_subfolders = list_items(service, singles_subfolder_query, fields="files(id)", page_size=1)

                            if found_subfolders is None:
                                print(f"    Failed query for '{SINGLES_FOLDER_NAME}' in '{item_name}' ({item_id}). Skipping.", file=sys.stderr)
                            elif found_subfolders:
                                source_singles_subfolder_id = found_subfolders[0].get('id')
                                print(f"    Found source '{SINGLES_FOLDER_NAME}' subfolder (ID hidden).")
                                # Ensure target structure exists
                                target_artist_folder_id = get_or_create_folder(service, item_name, target_general_folder_id)
                                if target_artist_folder_id:
                                    target_singles_subfolder_id = get_or_create_folder(service, SINGLES_FOLDER_NAME, target_artist_folder_id)
                                    if target_singles_subfolder_id:
                                        # Sync files efficiently
                                        print(f"    Syncing files between source/target '{SINGLES_FOLDER_NAME}' for '{item_name}'...")
                                        sync_files_between_folders(service, source_singles_subfolder_id, target_singles_subfolder_id, copy_counters, copy_limit_reached)
                                    else: print(f"    Failed to get/create target singles folder for '{item_name}'.", file=sys.stderr)
                                else: print(f"    Failed to get/create target artist folder '{item_name}'.", file=sys.stderr)
                            else:
                                print(f"    No '{SINGLES_FOLDER_NAME}' subfolder found in '{item_name}'. Assuming no singles to sync here.")
                        # Case 2: Folder likely containing collections (e.g., "מקבצי זמרים - סינגלים")
                        else: # Name contains SINGLES_FOLDER_NAME -> Use recursive sync
                            print(f"  Folder '{item_name}': Contains '{SINGLES_FOLDER_NAME}', initiating RECURSIVE sync into '{TARGET_SUBFOLDER_GENERAL}'.")
                            # We need a corresponding target folder for the collection itself
                            target_collection_folder_id = get_or_create_folder(service, item_name, target_general_folder_id)
                            if target_collection_folder_id:
                                copy_folder_recursively_optimized(service, item_id, target_collection_folder_id, copy_counters, copy_limit_reached)
                            else:
                                print(f"    Failed to get/create target folder '{item_name}' for recursive sync. Skipping.", file=sys.stderr)

                    else: # It's a file directly under the general source root
                        if item_name not in target_general_files_names:
                            if copy_counters['copied'][0] >= MAX_FILES_TO_COPY_PER_RUN:
                                print(f"\nReached copy limit ({MAX_FILES_TO_COPY_PER_RUN}). Stopping direct file checks.")
                                copy_limit_reached[0] = True
                                break
                            print(f"  File '{item_name}' is missing in target '{TARGET_SUBFOLDER_GENERAL}'. Queuing for copy.")
                            files_to_copy_direct.append({'id': item_id, 'name': item_name})
                        # else: print(f"  File '{item_name}' already exists in target.") # Reduce noise

                # Copy the direct files identified earlier
                if files_to_copy_direct:
                    print(f"\nCopying {len(files_to_copy_direct)} direct files to '{TARGET_SUBFOLDER_GENERAL}'...")
                    for file_info in files_to_copy_direct:
                        if copy_limit_reached[0]: break
                        copied_id = copy_file(service, file_info['id'], file_info['name'], target_general_folder_id)
                        if copied_id:
                             copy_counters['copied'][0] += 1
                             target_general_files_names.add(file_info['name']) # Update local set
                        else:
                             print(f"    Failed to copy direct file '{file_info['name']}' (Source ID: {file_info['id']})", file=sys.stderr)
                        time.sleep(0.1)

        # --- Sync Categorized Sources (Uses optimized logic internally) ---
        if not copy_limit_reached[0]:
            sync_categorized_source(service, SOURCE_ROOT_FOLDER_ID_CATEGORIZED_1, "Categorized Music 1", TARGET_ROOT_FOLDER_ID, SINGLES_FOLDER_NAME, EXCLUDED_CATEGORIES_1, ignored_singers, copy_counters, copy_limit_reached)
        if not copy_limit_reached[0]:
            sync_categorized_source(service, SOURCE_ROOT_FOLDER_ID_CATEGORIZED_2, "Categorized Music 2", TARGET_ROOT_FOLDER_ID, SINGLES_FOLDER_NAME, EXCLUDED_CATEGORIES_2, ignored_singers, copy_counters, copy_limit_reached)

        print(f"\n--- Phase 1 Summary: {copy_counters['copied'][0]} files copied. Limit reached: {copy_limit_reached[0]} ---")

        # --- Phase 2: Inventory ---
        print(f"\n--- Phase 2: Generating Inventory CSV: '{CSV_OUTPUT_FILENAME}' ---")
        inventory_serial_counter = [0]
        CSV_OUTPUT_FILENAME.parent.mkdir(parents=True, exist_ok=True)

        try:
            with open(CSV_OUTPUT_FILENAME, 'w', newline='', encoding='utf-8-sig') as csvfile:
                csv_writer = csv.writer(csvfile)
                csv_writer.writerow(CSV_HEADER)

                # Suppress target_root_id
                print(f"Scanning top-level categories in target root (ID hidden)...")
                target_top_level_query = f"'{TARGET_ROOT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
                target_category_folders = list_items(service, target_top_level_query, fields="files(id, name)")

                if target_category_folders is None:
                     print("Failed to list target category folders for inventory.", file=sys.stderr)
                elif not target_category_folders:
                     print("No category folders found in target to inventory.")
                else:
                    print(f"Found {len(target_category_folders)} target categories. Scanning each...")
                    for target_category in target_category_folders:
                        category_id = target_category.get('id'); category_name = target_category.get('name')
                        if not category_id or not category_name: continue
                        # Suppress category_id
                        print(f"\nScanning category: '{category_name}' (ID hidden)")
                        # Start inventory scan within this category
                        inventory_target_folder(service, category_id, csv_writer, inventory_serial_counter, "", category_name) # Pass category_name as the top-level context

                print(f"\nInventory complete. Found {inventory_serial_counter[0]} files. CSV saved to '{CSV_OUTPUT_FILENAME}'.")
        except IOError as e:
             print(f"FATAL: Error writing inventory CSV '{CSV_OUTPUT_FILENAME}': {e}", file=sys.stderr); sys.exit(1)
        except Exception as e:
             print(f"FATAL: Unexpected error during inventory CSV generation: {e}", file=sys.stderr); traceback.print_exc(file=sys.stderr); sys.exit(1)

        print("\n--- Sync and Inventory Script Finished Successfully ---")

    except HttpError as error:
        print(f'\nFATAL: An API error occurred during main processing: {error}', file=sys.stderr)
        status_code = getattr(error, 'resp', None) and getattr(error.resp, 'status', None)
        if status_code:
             print(f"HTTP Status Code: {status_code}", file=sys.stderr)
             if status_code == 403:
                  print("Suggestion: Check Drive API Quotas/Permissions or if token scope is sufficient.", file=sys.stderr)
             elif status_code == 404:
                  print("Suggestion: Verify Folder IDs are correct/accessible.", file=sys.stderr)
             elif status_code == 429:
                   print("Suggestion: Reduce frequency of runs or implement more aggressive backoff.", file=sys.stderr)
        content = getattr(error, 'content', None)
        if content:
             try: print(f"Response content: {content.decode()}", file=sys.stderr)
             except: print(f"Response content (raw): {content}", file=sys.stderr)
        else: print("No detailed response content available.", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\nFATAL: An unexpected general error occurred: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    run_sync_and_inventory()