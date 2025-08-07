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
    import google.auth.exceptions # Import for specific exceptions like RefreshError
except ImportError:
    print("Error: Required Google libraries not found. Please install them via pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib")
    sys.exit(1)

# --- הגדרות ---
SCOPES = ['https://www.googleapis.com/auth/drive'] # Kept drive scope, delete might need it depending on item ownership/permissions

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

# --- Authentication ---
def authenticate_github_actions():
    """
    Authenticates using credentials loaded from the GDRIVE_TOKEN_JSON_CONTENT
    environment variable (populated by GitHub Secrets).
    """
    creds = None
    token_json_content = os.environ.get('GDRIVE_TOKEN_JSON_CONTENT')

    if not token_json_content:
        print("שגיאה: משתנה הסביבה GDRIVE_TOKEN_JSON_CONTENT לא נמצא.", file=sys.stderr)
        print("ודא שהסוד הנכון (למשל, GDRIVE_TOKEN_JSON או GDRIVE_TOKEN_SYNC_INVENTORY) מוגדר בהגדרות מאגר GitHub.", file=sys.stderr)
        return None

    try:
        creds_info = json.loads(token_json_content)
        required_keys = ['client_id', 'client_secret', 'refresh_token', 'token_uri']
        if not all(key in creds_info for key in required_keys):
             print(f"שגיאה: ה-JSON של הטוקן חסר מפתחות נדרשים. נמצאו: {list(creds_info.keys())}. נדרשים לפחות: {required_keys}", file=sys.stderr)
             return None

        creds = Credentials.from_authorized_user_info(creds_info, SCOPES)

        if creds and creds.expired and creds.refresh_token:
            print("הטוקן פג תוקף, מנסה לרענן...")
            try:
                creds.refresh(Request())
                print("הטוקן רוענן בהצלחה.")
            except google.auth.exceptions.RefreshError as e:
                print(f"שגיאה: נכשל רענון הטוקן: {e}", file=sys.stderr)
                print("ייתכן שטוקן הרענון אינו תקף יותר או שהסכמת OAuth בוטלה.", file=sys.stderr)
                print("בדוק אם ה-Refresh Token עדיין תקף או אם הרשאת OAuth בוטלה.", file=sys.stderr)
                # Try to extract more specific info if available in the error object
                if hasattr(e, 'args') and len(e.args) > 0:
                    error_details = e.args[0]
                    print(f"פרטי שגיאה מה-API: {error_details}", file=sys.stderr)
                    if isinstance(error_details, dict):
                       error_code = error_details.get('error')
                       error_desc = error_details.get('error_description')
                       if error_code == 'invalid_grant':
                           print("שגיאת 'invalid_grant' מצביעה בדרך כלל על טוקן רענון שפג תוקפו או בוטל.", file=sys.stderr)
                       elif error_code:
                           print(f"קוד שגיאה: {error_code}, תיאור: {error_desc}", file=sys.stderr)

                return None
            except Exception as e:
                 print(f"שגיאה: כשל כללי בעת רענון הטוקן: {e}", file=sys.stderr)
                 traceback.print_exc(file=sys.stderr)
                 return None
        elif not creds or not creds.valid:
             print("שגיאה: האישורים שנטענו אינם תקפים ולא ניתן היה לרענן אותם.", file=sys.stderr)
             return None

        print("אימות הצליח באמצעות הטוקן שסופק.")
        return creds

    except json.JSONDecodeError as e:
        print(f"שגיאה: נכשל פיענוח JSON מ-GDRIVE_TOKEN_JSON_CONTENT: {e}", file=sys.stderr)
        print("ודא שהסוד מכיל JSON תקין.", file=sys.stderr)
        return None
    except Exception as e:
        print(f"שגיאה: אירעה שגיאה בלתי צפויה במהלך האימות: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return None


# --- Helper Functions ---
def list_items(service, query, fields="nextPageToken, files(id, name, mimeType)", order_by=None, page_size=1000):
    """Lists items matching the query, handling pagination and retries."""
    items = []
    page_token = None
    retries = 5 # Increased retries slightly
    delay = 1.5 # Increased initial delay
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
            time.sleep(0.2) # Small delay between pages
        except HttpError as error:
            current_retry += 1
            # Keep ID in error logs for debugging
            print(f"שגיאה אירעה במהלך list_items query='{query}': {error} (ניסיון {current_retry}/{retries})", file=sys.stderr)
            status_code = getattr(error, 'resp', None) and getattr(error.resp, 'status', None)
            is_retryable = status_code in [403, 429, 500, 502, 503, 504]
            reason = None
            try:
                # Error details can be complex, try to parse common structures
                error_json = json.loads(error.content)
                if isinstance(error_json, dict) and 'error' in error_json:
                    err_content = error_json['error']
                    if isinstance(err_content, dict) and 'errors' in err_content:
                         if isinstance(err_content['errors'], list) and len(err_content['errors']) > 0:
                              reason = err_content['errors'][0].get('reason')
            except: # Ignore parsing errors, just won't have the reason
                 pass

            # Handle specific 403 reasons if possible
            if status_code == 403 and reason in ['userRateLimitExceeded', 'rateLimitExceeded', 'backendError', 'internalError']: # Added internalError
                is_retryable = True # Force retry for these specific 403s
                print(f"שגיאה 403 ספציפית הניתנת לניסיון חוזר (reason='{reason}'). ממתין ומנסה שוב...", file=sys.stderr)

            if is_retryable and current_retry < retries:
                 wait_time = delay * (2 ** (current_retry - 1)) # Exponential backoff
                 print(f"שגיאה הניתנת לניסיון חוזר ({status_code}). מנסה שוב בעוד {wait_time:.2f} שניות...", file=sys.stderr)
                 time.sleep(wait_time)
                 delay = min(delay * 1.5, 60.0) # Increase delay but cap it
                 continue
            else:
                 print("לא ניתן היה לרשום פריטים לאחר ניסיונות חוזרים או שגיאה שאינה ניתנת לניסיון חוזר.", file=sys.stderr)
                 if status_code == 403: print("ככל הנראה שגיאת הרשאה או חריגה ממכסה.", file=sys.stderr)
                 if status_code == 404: print(f"פריט לא נמצא עבור השאילתה: {query}", file=sys.stderr)
                 return None # Indicate failure
        except Exception as e:
            print(f"שגיאה בלתי צפויה אירעה במהלך list_items query='{query}': {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            return None # Indicate failure
    return items

# --- Helper Function: Delete Item ---
def delete_drive_item(service, file_id, item_name):
    """
    Deletes a file or folder from Google Drive with retries.
    Logs item name but suppresses ID in standard logs. Includes ID in errors.
    Returns True on success, False on failure.
    """
    retries = 3
    delay = 1.0
    # Suppress ID in standard log
    print(f"      מנסה למחוק את '{item_name}' (ID מוסתר)... (ניסיון 1/{retries})")
    for i in range(retries):
        try:
            service.files().delete(fileId=file_id, supportsAllDrives=True).execute()
            # Suppress ID in standard log
            print(f"        '{item_name}' נמחק בהצלחה.")
            return True
        except HttpError as error:
            # Keep ID in error log for debugging
            status_code = getattr(error, 'resp', None) and getattr(error.resp, 'status', None)
            print(f"      שגיאה במחיקת '{item_name}' (ID: {file_id}): {error} (ניסיון {i+1}/{retries}, סטטוס: {status_code})", file=sys.stderr)

            if status_code == 404:
                print(f"      פריט '{item_name}' (ID: {file_id}) לא נמצא. ייתכן שכבר נמחק.", file=sys.stderr)
                return True # Treat as success if it's already gone

            if status_code in [403, 429, 500, 502, 503, 504] and i < retries - 1:
                print(f"      שגיאה הניתנת לניסיון חוזר ({status_code}). ממתין {delay:.2f} שניות...", file=sys.stderr)
                time.sleep(delay)
                delay *= 2
                print(f"      מנסה למחוק את '{item_name}' (ID: {file_id})... (ניסיון {i+2}/{retries})")
                continue
            else:
                print(f"      לא ניתן היה למחוק את '{item_name}' (ID: {file_id}) לאחר {i+1} ניסיונות או שגיאה שאינה ניתנת לניסיון חוזר.", file=sys.stderr)
                if status_code == 403: print("      שגיאת הרשאה (403). ודא שלחשבון יש הרשאות מחיקה.", file=sys.stderr)
                return False
        except Exception as e:
            # Keep ID in error log
            print(f"      שגיאה בלתי צפויה במהלך מחיקת '{item_name}' (ID: {file_id}): {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            # Log retry attempt if applicable
            if i < retries - 1:
                 print(f"      מנסה למחוק את '{item_name}' (ID: {file_id})... (ניסיון {i+2}/{retries})")
            time.sleep(delay) # Wait even on unexpected errors before retry
            delay *= 2
            continue # Retry on unexpected errors as well, up to the retry limit

    print(f"      המחיקה נכשלה עבור '{item_name}' (ID: {file_id}) לאחר כל הניסיונות.", file=sys.stderr)
    return False


# --- Helper Functions (get_or_create_folder, copy_file - Updated Logs) ---
def get_or_create_folder(service, name, parent_id):
    """
    Checks/Creates a folder. Logs folder names but suppresses parent_id in standard logs.
    Returns folder ID or None.
    """
    try:
        # Escape single quotes for the query string
        safe_name = name.replace("'", "\\'")
        # Keep parent_id in query, but don't log it routinely
        query = f"'{parent_id}' in parents and name = '{safe_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        # Request only 'id' and 'name' for efficiency
        existing_folders = list_items(service, query, fields="files(id, name)", page_size=1)

        if existing_folders is None: # list_items failed
            print(f"  נכשל ניסיון לאתר תיקיה קיימת '{name}' עקב שגיאת API.", file=sys.stderr)
            return None

        if existing_folders:
            folder_id = existing_folders[0].get('id')
            # Suppress parent_id in standard log
            # print(f"  נמצאה תיקיה קיימת '{existing_folders[0].get('name')}' (Parent ID מוסתר)") # Reduce noise
            return folder_id
        else:
            # Suppress parent_id in standard log
            print(f"  יוצר תיקיה '{name}' (Parent ID מוסתר)...")
            # Use the original name (without escaping) for folder creation metadata
            folder_metadata = {'name': name, 'mimeType': 'application/vnd.google-apps.folder', 'parents': [parent_id]}
            retries = 3
            delay = 1
            for i in range(retries):
                try:
                    folder = service.files().create(body=folder_metadata, fields='id, name', supportsAllDrives=True).execute()
                    folder_id = folder.get('id')
                    created_name = folder.get('name')
                    # Suppress folder_id in standard log
                    print(f"    נוצרה תיקיה '{created_name}' (ID מוסתר)")
                    return folder_id
                except HttpError as create_error:
                    # Keep name and parent_id in error log for debugging
                    print(f"    ניסיון {i+1}/{retries} נכשל ביצירת תיקיה '{name}' תחת הורה {parent_id}: {create_error}", file=sys.stderr)
                    status_code = getattr(create_error, 'resp', None) and getattr(create_error.resp, 'status', None)
                    if status_code in [403, 429, 500, 503] and i < retries - 1:
                        print(f"    מנסה ליצור תיקיה שוב בעוד {delay} שניות...", file=sys.stderr)
                        time.sleep(delay); delay *= 2; continue
                    else:
                        print(f"    נכשל ביצירת תיקיה '{name}' לאחר ניסיונות חוזרים או שגיאה שאינה ניתנת לניסיון חוזר.", file=sys.stderr)
                        return None
                except Exception as e_create:
                     # Keep name and parent_id in error log
                     print(f"    שגיאה בלתי צפויה ביצירת תיקיה '{name}' תחת הורה {parent_id} (ניסיון {i+1}): {e_create}", file=sys.stderr)
                     return None
            return None
    except Exception as e:
        # Keep name and parent_id in error log
        print(f"  שגיאה בלתי צפויה ב-get_or_create_folder עבור '{name}' תחת הורה {parent_id}: {e}", file=sys.stderr)
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
            print(f"    מנסה להעתיק את '{file_name}' (Source ID מוסתר) לתיקיית יעד (ID מוסתר) (ניסיון {i+1}/{retries})...")
            copy_metadata = {'name': file_name, 'parents': [target_parent_id]}
            copied_file = service.files().copy(fileId=source_file_id, body=copy_metadata, fields='id, name', supportsAllDrives=True).execute()
            copy_id = copied_file.get('id')
            # Suppress copy_id in standard log
            # print(f"      הועתק בהצלחה '{copied_file.get('name')}' - מזהה העתק חדש מוסתר") # Reduce noise
            return copy_id
        except HttpError as error:
            # Keep IDs in error log for debugging
            print(f"      שגיאה בהעתקת קובץ '{file_name}' (מזהה מקור: {source_file_id}, הורה יעד: {target_parent_id}): {error}", file=sys.stderr)
            status_code = getattr(error, 'resp', None) and getattr(error.resp, 'status', None)
            reason = None
            try:
                # Error details can be complex, try to parse common structures
                error_json = json.loads(error.content)
                if isinstance(error_json, dict) and 'error' in error_json:
                    err_content = error_json['error']
                    if isinstance(err_content, dict) and 'errors' in err_content:
                         if isinstance(err_content['errors'], list) and len(err_content['errors']) > 0:
                              reason = err_content['errors'][0].get('reason')
            except: # Ignore parsing errors, just won't have the reason
                 pass


            is_retryable = status_code in [403, 429, 500, 502, 503, 504]
            if status_code == 403 and reason in ['userRateLimitExceeded', 'rateLimitExceeded', 'backendError', 'internalError']:
                is_retryable = True
                print(f"      שגיאת 403 ספציפית הניתנת לניסיון חוזר (reason='{reason}'). ממתין ומנסה שוב...", file=sys.stderr)


            if is_retryable and i < retries - 1:
                wait_time = delay + (delay * i * 0.5) + (delay * 0.2 * (i+1)) # Exponential backoff with jitter
                print(f"      שגיאה הניתנת לניסיון חוזר ({status_code}, reason={reason}). מנסה שוב בעוד {wait_time:.2f} שניות...", file=sys.stderr)
                time.sleep(wait_time)
                delay = min(delay * 1.5, 32.0)
                continue
            else: # Handle non-retryable errors or exhausted retries
                 if status_code == 404:
                    print(f"      מזהה קובץ המקור {source_file_id} לא נמצא. לא ניתן להעתיק.", file=sys.stderr); return None
                 if status_code == 403:
                    print(f"      שגיאת הרשאה או חריגה ממכסה (403, reason={reason}).", file=sys.stderr)
                 if status_code == 400 and 'invalid parents field' in str(error).lower():
                     print(f"      מזהה תיקיית הורה היעד '{target_parent_id}' אינו תקין. לא ניתן להעתיק.", file=sys.stderr); return None
                 print(f"      לא ניתן היה להעתיק את הקובץ '{file_name}' (מזהה מקור: {source_file_id}) לאחר {i+1} ניסיונות או שגיאה שאינה ניתנת לניסיון חוזר.", file=sys.stderr)
                 return None
        except Exception as e:
            # Keep IDs in error log
            print(f"      שגיאה בלתי צפויה במהלך העתקת '{file_name}' (מזהה מקור: {source_file_id}): {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            return None
    print(f"      ההעתקה נכשלה עבור '{file_name}' (מזהה מקור: {source_file_id}) לאחר כל הניסיונות.", file=sys.stderr)
    return None

# --- Load Ignored List Helper (No changes needed) ---
def load_ignored_list(filename_path):
    ignored_set = set()
    if not filename_path.is_file():
        print(f"אזהרה: קובץ ההתעלמות '{filename_path}' לא נמצא.", file=sys.stderr)
        return ignored_set
    try:
        with open(filename_path, 'r', encoding='utf-8') as f:
            for line in f:
                name = line.strip()
                if name and not name.startswith('#'):
                    ignored_set.add(name)
        print(f"נטענו {len(ignored_set)} שמות להתעלמות מתוך '{filename_path}'.")
    except Exception as e:
        print(f"שגיאה בקריאת קובץ התעלמות '{filename_path}': {e}", file=sys.stderr)
    return ignored_set

# --- Optimized Sync Functions ---

def sync_files_between_folders(service, source_folder_id, target_folder_id, copy_counters, limit_flag):
    """
    Efficiently syncs files from source to target folder.
    Fetches lists of files from both, compares locally, and copies only missing files.
    """
    if limit_flag[0]: return

    # Suppress IDs
    print(f"      מרכז קבצים בתיקיית מקור (ID מוסתר)...")
    source_files_query = f"'{source_folder_id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false"
    source_items = list_items(service, source_files_query, fields="files(id, name)")
    if source_items is None:
        print(f"      נכשל ברישום קבצי מקור ב-{source_folder_id}. מדלג על סנכרון עבור זוג תיקיות זה.", file=sys.stderr)
        return

    # Suppress IDs
    print(f"      מרכז קבצים בתיקיית יעד (ID מוסתר)...")
    target_files_query = f"'{target_folder_id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false"
    target_items = list_items(service, target_files_query, fields="files(name)") # Only need names for target check
    if target_items is None:
        print(f"      נכשל ברישום קבצי יעד ב-{target_folder_id}. מדלג על סנכרון עבור זוג תיקיות זה.", file=sys.stderr)
        return

    source_files_map = {item['name']: item['id'] for item in source_items if 'name' in item and 'id' in item}
    target_file_names = {item['name'] for item in target_items if 'name' in item}

    files_to_copy_count = 0
    files_to_copy_list = []
    for file_name, source_file_id in source_files_map.items():
        if limit_flag[0]: break
        if file_name not in target_file_names:
            if copy_counters['copied'][0] >= MAX_FILES_TO_COPY_PER_RUN:
                print(f"\nהגעת למגבלת ההעתקה ({MAX_FILES_TO_COPY_PER_RUN}). מפסיק בדיקות נוספות בתיקיה זו.")
                limit_flag[0] = True
                break
            files_to_copy_count += 1
            files_to_copy_list.append({'id': source_file_id, 'name': file_name})

    if files_to_copy_count > 0:
        print(f"      נמצאו {files_to_copy_count} קבצים להעתקה מהמקור (ID מוסתר) ליעד (ID מוסתר).")
        for file_info in files_to_copy_list:
            if limit_flag[0]: break
            copied_id = copy_file(service, file_info['id'], file_info['name'], target_folder_id)
            if copied_id:
                copy_counters['copied'][0] += 1
                # Add the newly copied file name to the target set to avoid re-copying if script runs again before inventory
                target_file_names.add(file_info['name'])
            else:
                 # Keep ID in error log
                 print(f"      נכשל בהעתקת קובץ '{file_info['name']}' (מזהה מקור: {file_info['id']}).", file=sys.stderr)
            time.sleep(0.1) # Keep small delay between copy operations
    # else: # Reduce noise
    #     print(f"      אין קבצים חדשים להעתקה עבור זוג תיקיות זה.")


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
        print(f"  שגיאה בקבלת שם תיקיית מקור עבור ID {source_folder_id}: {e}. מדלג על סנכרון רקורסיבי.", file=sys.stderr)
        return
    except Exception as e:
        print(f"  שגיאה בלתי צפויה בקבלת מידע על תיקיית מקור {source_folder_id}: {e}. מדלג.", file=sys.stderr)
        return

    # Suppress IDs in standard log
    print(f"\n  סנכרון רקורסיבי: '{source_folder_name}' (ID מוסתר) -> הורה יעד (ID מוסתר)")

    # 1. List items in source and target
    print(f"    מרכז פריטים במקור '{source_folder_name}' (ID מוסתר)...")
    source_query = f"'{source_folder_id}' in parents and trashed = false"
    source_items = list_items(service, source_query, fields="files(id, name, mimeType)")
    if source_items is None:
        print(f"    נכשל ברישום פריטי מקור ב-{source_folder_name} ({source_folder_id}). מבטל סנכרון לענף זה.", file=sys.stderr)
        return

    print(f"    מרכז פריטים בהורה יעד (ID מוסתר)...")
    target_query = f"'{target_parent_id}' in parents and trashed = false"
    target_items = list_items(service, target_query, fields="files(id, name, mimeType)")
    if target_items is None:
        print(f"    נכשל ברישום פריטי יעד בהורה {target_parent_id}. מבטל סנכרון לענף זה.", file=sys.stderr)
        return

    # 2. Create lookups
    source_files = {item['name']: item['id'] for item in source_items if item.get('mimeType') != 'application/vnd.google-apps.folder' and 'name' in item and 'id' in item}
    source_folders = {item['name']: item['id'] for item in source_items if item.get('mimeType') == 'application/vnd.google-apps.folder' and 'name' in item and 'id' in item}
    target_files = {item['name'] for item in target_items if item.get('mimeType') != 'application/vnd.google-apps.folder' and 'name' in item}
    target_folders = {item['name']: item['id'] for item in target_items if item.get('mimeType') == 'application/vnd.google-apps.folder' and 'name' in item and 'id' in item}

    # 3. Process Folders (Recursively)
    print(f"    מעבד {len(source_folders)} תיקיות משנה שנמצאו ב-' {source_folder_name}'...")
    for folder_name, source_subfolder_id in source_folders.items():
        if limit_flag[0]: break
        target_subfolder_id = None
        if folder_name in target_folders:
            target_subfolder_id = target_folders[folder_name]
            # print(f"      נמצאה תיקיית משנה קיימת ביעד '{folder_name}'") # Reduce noise
        else:
            print(f"      תיקיית משנה ביעד '{folder_name}' חסרה, יוצר...")
            target_subfolder_id = get_or_create_folder(service, folder_name, target_parent_id)

        if target_subfolder_id:
            # Recursive call
            copy_folder_recursively_optimized(service, source_subfolder_id, target_subfolder_id, copy_counters, limit_flag)
        else:
             # Keep IDs in error log
            print(f"      נכשל בקבלה/יצירה של תיקיית משנה ביעד '{folder_name}' תחת הורה {target_parent_id}. מדלג על סנכרון לענף זה.", file=sys.stderr)

    # 4. Process Files (Optimized Sync)
    print(f"    מעבד {len(source_files)} קבצים שנמצאו ב-' {source_folder_name}'...")
    files_to_copy_list = []
    for file_name, source_file_id in source_files.items():
        if limit_flag[0]: break
        if file_name not in target_files:
             if copy_counters['copied'][0] >= MAX_FILES_TO_COPY_PER_RUN:
                 print(f"\nהגעת למגבלת ההעתקה ({MAX_FILES_TO_COPY_PER_RUN}). מפסיק בדיקות נוספות.")
                 limit_flag[0] = True
                 break
             files_to_copy_list.append({'id': source_file_id, 'name': file_name})

    if files_to_copy_list:
        print(f"      נמצאו {len(files_to_copy_list)} קבצים להעתקה ב-' {source_folder_name}'...")
        for file_info in files_to_copy_list:
             if limit_flag[0]: break
             copied_id = copy_file(service, file_info['id'], file_info['name'], target_parent_id)
             if copied_id:
                 copy_counters['copied'][0] += 1
                 # Add to target set to prevent potential duplicates if script runs quickly again
                 target_files.add(file_info['name'])
             else:
                 # Keep IDs in error log
                 print(f"      נכשל בהעתקת קובץ '{file_info['name']}' (מזהה מקור: {file_info['id']}) ליעד {target_parent_id}.", file=sys.stderr)
             time.sleep(0.1)


def sync_categorized_source(service, source_root_id, source_description, target_root_id, singles_folder_name,
                            excluded_categories, ignored_singers_set, copy_counters, limit_flag):
    """
    Syncs categorized source using optimized file checking. Logs names but suppresses IDs.
    SKIPS copying ignored singers.
    """
    # Suppress source_root_id
    print(f"\n--- עיבוד מקור מקוטלג: {source_description} (מזהה מקור מוסתר) ---")
    # Suppress source_root_id
    print(f"מחפש תיקיות קטגוריה תחת שורש המקור (ID מוסתר)")
    source_category_query = f"'{source_root_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    source_category_folders = list_items(service, source_category_query, fields="files(id, name)", order_by="name")

    if source_category_folders is None:
        print(f"נכשל ברישום תיקיות קטגוריה במקור עבור {source_description}. מדלג.", file=sys.stderr)
        return
    if not source_category_folders:
        print(f"לא נמצאו תיקיות קטגוריה תחת שורש המקור עבור {source_description}.")
        return
    print(f"נמצאו {len(source_category_folders)} תיקיות קטגוריה במקור ב- {source_description}.")

    for category_folder in source_category_folders:
        if limit_flag[0]: break
        category_name = category_folder.get('name'); category_id = category_folder.get('id')
        if not category_name or not category_id: continue

        # Suppress category_id
        print(f"\n>>> עיבוד קטגוריית מקור: '{category_name}' (ID מוסתר) מתוך {source_description}")
        if category_name in excluded_categories: print(f"  מדלג על קטגוריה מוחרגת '{category_name}'."); continue

        # --- Check if target category exists BEFORE processing artists ---
        # We need the target category ID to find artists within it for deletion, but only create it if needed for copying.
        target_category_folder_id = None
        # ***************************************************************
        # ***** START FIX for f-string backslash error *****
        # Escape single quotes in the category name for the query
        safe_category_name_for_query = category_name.replace("'", "\\'")
        target_category_query = f"'{target_root_id}' in parents and name = '{safe_category_name_for_query}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        # ***** END FIX for f-string backslash error *****
        # ***************************************************************
        existing_target_categories = list_items(service, target_category_query, fields="files(id)", page_size=1)
        if existing_target_categories:
            target_category_folder_id = existing_target_categories[0].get('id')
        # --- End Check ---

        # If target category exists, we might need to check for ignored artists to delete later (done in Phase 0)

        # List source artist folders regardless of target category existence for now
        source_artist_query = f"'{category_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        source_artist_folders = list_items(service, source_artist_query, fields="files(id, name)")
        if source_artist_folders is None:
            # Keep category_id in error log
            print(f"  נכשל ברישום תיקיות אמן בקטגוריה '{category_name}' ({category_id}). מדלג על הקטגוריה.", file=sys.stderr)
            continue
        if not source_artist_folders:
            # print(f"  לא נמצאו תיקיות אמן בקטגוריה '{category_name}'.") # Reduce noise
            continue

        print(f"  מעבד {len(source_artist_folders)} תיקיות אמן ב-' {category_name}'...")
        artists_processed_in_category = False # Flag to create target category only if needed
        for artist_folder in source_artist_folders:
            if limit_flag[0]: break
            artist_name = artist_folder.get('name'); source_artist_folder_id = artist_folder.get('id')
            if not artist_name or not source_artist_folder_id: continue

            # --- Check Ignore List ---
            artist_ignored = any(ignored_name in artist_name for ignored_name in ignored_singers_set)
            if artist_ignored:
                print(f"    מדלג על תיקיית אמן '{artist_name}' מהמקור (נמצא ברשימת התעלמות).")
                continue # Skip copying this artist's folder

            # --- If artist is NOT ignored, proceed with sync logic ---
            # Look for the specific "singles" subfolder in the source artist folder
            singles_subfolder_query = f"'{source_artist_folder_id}' in parents and name = '{singles_folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
            found_singles_subfolders = list_items(service, singles_subfolder_query, fields="files(id)", page_size=1)

            if found_singles_subfolders is None:
                 # Keep IDs in error log
                 print(f"    נכשלה שאילתה עבור '{singles_folder_name}' ב-' {artist_name}' ({source_artist_folder_id}). מדלג על אמן.", file=sys.stderr)
                 continue
            if not found_singles_subfolders:
                 # print(f"    לא נמצאה תיקיית משנה '{singles_folder_name}' עבור האמן '{artist_name}'.") # Reduce noise
                 continue

            source_singles_subfolder_id = found_singles_subfolders[0].get('id')
            if not source_singles_subfolder_id: continue # Should not happen if list_items worked

            # --- Now we need the target category folder ID ---
            # Create target category ONLY if we have something to copy into it
            if not artists_processed_in_category: # First non-ignored artist in this category
                if not target_category_folder_id: # Check if we found it earlier
                    print(f"  יוצר תיקיית יעד לקטגוריה '{category_name}'...")
                    target_category_folder_id = get_or_create_folder(service, category_name, target_root_id) # Log inside suppresses ID
                    if not target_category_folder_id:
                        # Keep name and target_root_id in error log
                        print(f"  נכשל בקבלה/יצירה של תיקיית קטגוריה ביעד '{category_name}' תחת שורש היעד {target_root_id}. מדלג על שארית הקטגוריה.", file=sys.stderr)
                        break # Skip rest of artists in this source category
                artists_processed_in_category = True

            if not target_category_folder_id: continue # Skip artist if target category failed

            # Suppress IDs in standard log
            print(f"    נמצא מקור '{singles_folder_name}' עבור '{artist_name}' (מזהי אמן/סינגלים במקור מוסתרים)")

            # Ensure corresponding target structure exists (artist and singles)
            target_artist_folder_id = get_or_create_folder(service, artist_name, target_category_folder_id) # Log inside suppresses ID
            if not target_artist_folder_id:
                print(f"    נכשל בקבלה/יצירה של תיקיית אמן ביעד '{artist_name}'. מדלג על אמן.", file=sys.stderr)
                continue
            target_singles_subfolder_id = get_or_create_folder(service, singles_folder_name, target_artist_folder_id) # Log inside suppresses ID
            if not target_singles_subfolder_id:
                 print(f"    נכשל בקבלה/יצירה של תיקיית סינגלים ביעד עבור '{artist_name}'. מדלג על אמן.", file=sys.stderr)
                 continue

            # Perform the efficient file sync between the source and target singles folders
            print(f"      מסנכרן קבצים בין תיקיות מקור/יעד '{singles_folder_name}' עבור '{artist_name}'...")
            sync_files_between_folders(service, source_singles_subfolder_id, target_singles_subfolder_id, copy_counters, limit_flag)


# --- Recursive Inventory Function (Updated Logs - No functional change needed here) ---
def inventory_target_folder(service, folder_id, csv_writer, serial_counter, current_path_str, parent_category):
    """
    Recursively scans target folder. Logs names but suppresses IDs. Writes CSV.
    """
    query = f"'{folder_id}' in parents and trashed = false"
    items = list_items(service, query, fields="nextPageToken, files(id, name, mimeType)")
    if items is None:
        # Keep folder_id and parent_category in error log
        print(f"    נכשל ברישום פריטים במהלך המלאי בתיקיה {folder_id} (קטגוריה: {parent_category}). מדלג על תיקיה זו.", file=sys.stderr)
        return

    for item in items:
        item_id = item.get('id'); item_name = item.get('name'); item_mime_type = item.get('mimeType')
        if not item_id or not item_name:
            # Keep folder_id in error log
            print(f"    מדלג על פריט עם ID/שם חסר במהלך המלאי בתיקיה {folder_id} (קטגוריה: {parent_category})", file=sys.stderr)
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
                print(f"      שגיאה בכתיבת שורת CSV עבור '{item_name}' (ID: {item_id}, קטגוריה: {parent_category}): {csv_err}", file=sys.stderr)

# --- Main Processing Function (Updated Logs & Logic) ---
def run_sync_and_inventory():
    print("מתחיל תהליך סנכרון ויצירת מלאי דרייב...")
    creds = authenticate_github_actions()
    if not creds: print("אימות נכשל. יוצא.", file=sys.stderr); sys.exit(1)

    ignored_singers = load_ignored_list(IGNORE_SINGERS_FILE)

    try:
        service = build('drive', 'v3', credentials=creds, cache_discovery=False) # Disable discovery cache for potential issues
        print("אימות ובניית שירות Drive הושלמו בהצלחה.")

        # --- Phase 0: Cleanup Ignored Items in Target ---
        print(f"\n--- שלב 0: ניקוי פריטים מהיעד שברשימת ההתעלמות ({len(ignored_singers)} שמות) ---")
        if not ignored_singers:
            print("רשימת ההתעלמות ריקה, מדלג על שלב הניקוי.")
        else:
            print(f"סורק תיקיות קטגוריה בשורש היעד (ID מוסתר) לאיתור פריטים למחיקה...")
            target_top_level_query = f"'{TARGET_ROOT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
            target_category_folders = list_items(service, target_top_level_query, fields="files(id, name)")

            if target_category_folders is None:
                print("נכשל ברישום תיקיות קטגוריה ביעד לצורך ניקוי. מדלג על שלב הניקוי.", file=sys.stderr)
            elif not target_category_folders:
                print("לא נמצאו תיקיות קטגוריה ביעד לניקוי.")
            else:
                print(f"נמצאו {len(target_category_folders)} קטגוריות יעד. בודק כל אחת...")
                target_general_folder_id_for_cleanup = None # Store ID for later specific check

                for target_category in target_category_folders:
                    category_id = target_category.get('id'); category_name = target_category.get('name')
                    if not category_id or not category_name: continue

                    # Store the ID of the general folder if found
                    if category_name == TARGET_SUBFOLDER_GENERAL:
                        target_general_folder_id_for_cleanup = category_id

                    # Suppress category_id
                    print(f"\n  בודק קטגוריית יעד: '{category_name}' (ID מוסתר)")
                    # List artist folders inside this target category
                    # Escape single quotes in category name for the query
                    safe_category_name_for_query_phase0 = category_name.replace("'", "\\'")
                    target_artist_query = f"'{category_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false" # Query uses ID, no need to escape name here
                    target_artist_folders = list_items(service, target_artist_query, fields="files(id, name)")

                    if target_artist_folders is None:
                        print(f"    נכשל ברישום תיקיות אמן ביעד בקטגוריה '{category_name}'. מדלג על בדיקת קטגוריה זו.", file=sys.stderr)
                        continue
                    if not target_artist_folders:
                        # print(f"    לא נמצאו תיקיות אמן ביעד בקטגוריה '{category_name}'.") # Reduce noise
                        continue

                    print(f"    נמצאו {len(target_artist_folders)} תיקיות אמן פוטנציאליות ביעד '{category_name}'. בודק מול רשימת ההתעלמות...")
                    for artist_folder in target_artist_folders:
                        artist_name = artist_folder.get('name'); artist_id = artist_folder.get('id')
                        if not artist_name or not artist_id: continue

                        # Check if this artist folder name matches any ignored name
                        is_ignored = any(ignored_name in artist_name for ignored_name in ignored_singers)
                        if is_ignored:
                             # Suppress artist_id in standard log
                             print(f"    -> מצא התאמה להתעלמות: תיקיית אמן '{artist_name}' (ID מוסתר) בקטגוריה '{category_name}'. מנסה למחוק...")
                             delete_drive_item(service, artist_id, f"{category_name}/{artist_name}") # Pass path for logging
                        # else: # Reduce noise
                        #     print(f"    '{artist_name}' לא ברשימת ההתעלמות.")

                # --- Specific check for items directly under "כללי" target folder ---
                if target_general_folder_id_for_cleanup:
                    print(f"\n  בודק פריטים ישירות תחת תיקיית היעד '{TARGET_SUBFOLDER_GENERAL}' (ID מוסתר)...")
                    general_items_query = f"'{target_general_folder_id_for_cleanup}' in parents and trashed = false"
                    # List ALL item types here (folders, files)
                    target_general_items = list_items(service, general_items_query, fields="files(id, name, mimeType)")

                    if target_general_items is None:
                         print(f"    נכשל ברישום פריטים תחת '{TARGET_SUBFOLDER_GENERAL}' ביעד. מדלג על בדיקה זו.", file=sys.stderr)
                    elif not target_general_items:
                         print(f"    לא נמצאו פריטים ישירות תחת '{TARGET_SUBFOLDER_GENERAL}' ביעד.")
                    else:
                        print(f"    נמצאו {len(target_general_items)} פריטים תחת '{TARGET_SUBFOLDER_GENERAL}'. בודק מול רשימת ההתעלמות...")
                        for item in target_general_items:
                            item_name = item.get('name'); item_id = item.get('id')
                            if not item_name or not item_id: continue

                            # Check if this item name matches any ignored name
                            is_ignored = any(ignored_name in item_name for ignored_name in ignored_singers)
                            if is_ignored:
                                item_type = "תיקיה" if item.get('mimeType') == 'application/vnd.google-apps.folder' else "קובץ/אחר"
                                # Suppress item_id in standard log
                                print(f"    -> מצא התאמה להתעלמות: {item_type} '{item_name}' (ID מוסתר) תחת '{TARGET_SUBFOLDER_GENERAL}'. מנסה למחוק...")
                                delete_drive_item(service, item_id, f"{TARGET_SUBFOLDER_GENERAL}/{item_name}")
                            # else: # Reduce noise
                            #     print(f"    פריט '{item_name}' לא ברשימת ההתעלמות.")
                else:
                    print(f"\n  תיקיית היעד '{TARGET_SUBFOLDER_GENERAL}' לא נמצאה, לא ניתן לבדוק פריטים ישירות תחתיה.")


        # --- Phase 1: Syncing Sources to Target ---
        copy_counters = {'copied': [0]}; copy_limit_reached = [False]
        print("\n--- שלב 1: סנכרון מקורות ליעד (מותאם) ---")

        # --- Sync General Source ---
        print(f"\n--- סנכרון מקור כללי (ID מוסתר) -> '{TARGET_SUBFOLDER_GENERAL}' ---")
        target_general_folder_id = get_or_create_folder(service, TARGET_SUBFOLDER_GENERAL, TARGET_ROOT_FOLDER_ID)
        if not target_general_folder_id:
            print(f"קריטי: לא ניתן היה לקבל/ליצור תיקיית משנה ביעד '{TARGET_SUBFOLDER_GENERAL}' תחת שורש {TARGET_ROOT_FOLDER_ID}. מבטל.", file=sys.stderr)
            sys.exit(1)
        else:
            print(f"תיקיית משנה ביעד '{TARGET_SUBFOLDER_GENERAL}' אושרה/נוצרה (ID מוסתר)")

            # List top-level items in the general source
            source_general_top_query = f"'{SOURCE_ROOT_FOLDER_ID_GENERAL}' in parents and trashed = false"
            source_general_top_items = list_items(service, source_general_top_query, fields="files(id, name, mimeType)", order_by="name")

            if source_general_top_items is None:
                 print("נכשל ברישום פריטים משורש המקור הכללי. מדלג על סנכרון כללי.", file=sys.stderr)
            elif not source_general_top_items:
                 print("לא נמצאו פריטים ישירות תחת שורש המקור הכללי.")
            else:
                print(f"מעבד {len(source_general_top_items)} פריטים ברמה עליונה מהמקור הכללי...")
                # List target direct files ONCE for comparison
                print(f"  מרכז קבצים קיימים ישירות תחת '{TARGET_SUBFOLDER_GENERAL}' (ID מוסתר)...")
                target_general_files_query = f"'{target_general_folder_id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false"
                target_general_items = list_items(service, target_general_files_query, fields="files(name)")
                target_general_files_names = {item['name'] for item in target_general_items} if target_general_items else set()
                print(f"  נמצאו {len(target_general_files_names)} קבצים קיימים ביעד.")

                files_to_copy_direct = []

                for source_item in source_general_top_items:
                    if copy_limit_reached[0]: break
                    item_name = source_item.get('name'); item_id = source_item.get('id'); item_mime_type = source_item.get('mimeType')
                    if not item_name or not item_id: continue

                    print(f"\nמעבד פריט כללי: '{item_name}' (סוג: {item_mime_type}, ID מוסתר)")

                    # --- Check Ignore List for Source Item ---
                    item_ignored = any(ignored_name in item_name for ignored_name in ignored_singers)
                    if item_ignored:
                        print(f"  מדלג על פריט מקור '{item_name}' (נמצא ברשימת התעלמות).")
                        continue # Skip processing (copying) this ignored item

                    # --- Process Non-Ignored Item ---
                    if item_mime_type == 'application/vnd.google-apps.folder':
                        # Case 1: Folder potentially containing 'סינגלים' (Artist-like folder)
                        if SINGLES_FOLDER_NAME not in item_name: # Heuristic: if name doesn't contain 'singles', treat as artist folder
                            print(f"  תיקיה '{item_name}': בודק קיום תיקיית משנה '{SINGLES_FOLDER_NAME}'.")
                            singles_subfolder_query = f"'{item_id}' in parents and name = '{SINGLES_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
                            found_subfolders = list_items(service, singles_subfolder_query, fields="files(id)", page_size=1)

                            if found_subfolders is None:
                                print(f"    נכשלה שאילתה עבור '{SINGLES_FOLDER_NAME}' ב-' {item_name}' ({item_id}). מדלג.", file=sys.stderr)
                            elif found_subfolders:
                                source_singles_subfolder_id = found_subfolders[0].get('id')
                                print(f"    נמצאה תיקיית משנה '{SINGLES_FOLDER_NAME}' במקור (ID מוסתר).")
                                # Ensure target structure exists
                                target_artist_folder_id = get_or_create_folder(service, item_name, target_general_folder_id)
                                if target_artist_folder_id:
                                    target_singles_subfolder_id = get_or_create_folder(service, SINGLES_FOLDER_NAME, target_artist_folder_id)
                                    if target_singles_subfolder_id:
                                        # Sync files efficiently
                                        print(f"    מסנכרן קבצים בין מקור/יעד '{SINGLES_FOLDER_NAME}' עבור '{item_name}'...")
                                        sync_files_between_folders(service, source_singles_subfolder_id, target_singles_subfolder_id, copy_counters, copy_limit_reached)
                                    else: print(f"    נכשל בקבלה/יצירה של תיקיית סינגלים ביעד עבור '{item_name}'.", file=sys.stderr)
                                else: print(f"    נכשל בקבלה/יצירה של תיקיית אמן ביעד '{item_name}'.", file=sys.stderr)
                            else:
                                print(f"    לא נמצאה תיקיית משנה '{SINGLES_FOLDER_NAME}' ב-' {item_name}'. מניח שאין סינגלים לסנכרן כאן.")
                        # Case 2: Folder likely containing collections (e.g., "מקבצי זמרים - סינגלים")
                        else: # Name contains SINGLES_FOLDER_NAME -> Use recursive sync
                            print(f"  תיקיה '{item_name}': מכילה '{SINGLES_FOLDER_NAME}', מתחיל סנכרון רקורסיבי אל '{TARGET_SUBFOLDER_GENERAL}'.")
                            # We need a corresponding target folder for the collection itself
                            target_collection_folder_id = get_or_create_folder(service, item_name, target_general_folder_id)
                            if target_collection_folder_id:
                                copy_folder_recursively_optimized(service, item_id, target_collection_folder_id, copy_counters, copy_limit_reached)
                            else:
                                print(f"    נכשל בקבלה/יצירה של תיקיית יעד '{item_name}' לסנכרון רקורסיבי. מדלג.", file=sys.stderr)

                    else: # It's a file directly under the general source root
                        if item_name not in target_general_files_names:
                            if copy_counters['copied'][0] >= MAX_FILES_TO_COPY_PER_RUN:
                                print(f"\nהגעת למגבלת ההעתקה ({MAX_FILES_TO_COPY_PER_RUN}). מפסיק בדיקות קבצים ישירים.")
                                copy_limit_reached[0] = True
                                break
                            print(f"  קובץ '{item_name}' חסר ביעד '{TARGET_SUBFOLDER_GENERAL}'. מוסיף לתור להעתקה.")
                            files_to_copy_direct.append({'id': item_id, 'name': item_name})
                        # else: print(f"  קובץ '{item_name}' כבר קיים ביעד.") # Reduce noise

                # Copy the direct files identified earlier
                if files_to_copy_direct:
                    print(f"\nמעתיק {len(files_to_copy_direct)} קבצים ישירים אל '{TARGET_SUBFOLDER_GENERAL}'...")
                    for file_info in files_to_copy_direct:
                        if copy_limit_reached[0]: break
                        copied_id = copy_file(service, file_info['id'], file_info['name'], target_general_folder_id)
                        if copied_id:
                             copy_counters['copied'][0] += 1
                             target_general_files_names.add(file_info['name']) # Update local set
                        else:
                             # Keep source ID in error log
                             print(f"    נכשל בהעתקת קובץ ישיר '{file_info['name']}' (מזהה מקור: {file_info['id']})", file=sys.stderr)
                        time.sleep(0.1)

        # --- Sync Categorized Sources (Uses optimized logic internally and checks ignore list) ---
        if not copy_limit_reached[0]:
            sync_categorized_source(service, SOURCE_ROOT_FOLDER_ID_CATEGORIZED_1, "מוזיקה מקוטלגת 1", TARGET_ROOT_FOLDER_ID, SINGLES_FOLDER_NAME, EXCLUDED_CATEGORIES_1, ignored_singers, copy_counters, copy_limit_reached)
        if not copy_limit_reached[0]:
            sync_categorized_source(service, SOURCE_ROOT_FOLDER_ID_CATEGORIZED_2, "מוזיקה מקוטלגת 2", TARGET_ROOT_FOLDER_ID, SINGLES_FOLDER_NAME, EXCLUDED_CATEGORIES_2, ignored_singers, copy_counters, copy_limit_reached)

        print(f"\n--- סיכום שלב 1: {copy_counters['copied'][0]} קבצים הועתקו. הגעה למגבלה: {copy_limit_reached[0]} ---")

        # --- Phase 2: Inventory ---
        print(f"\n--- שלב 2: יצירת קובץ מלאי CSV: '{CSV_OUTPUT_FILENAME}' ---")
        inventory_serial_counter = [0]
        CSV_OUTPUT_FILENAME.parent.mkdir(parents=True, exist_ok=True)

        try:
            # Use utf-8-sig to ensure BOM for Excel compatibility with Hebrew
            with open(CSV_OUTPUT_FILENAME, 'w', newline='', encoding='utf-8-sig') as csvfile:
                csv_writer = csv.writer(csvfile)
                csv_writer.writerow(CSV_HEADER)

                # Suppress target_root_id
                print(f"סורק קטגוריות ברמה עליונה בשורש היעד (ID מוסתר)...")
                target_top_level_query_inv = f"'{TARGET_ROOT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
                target_category_folders_inv = list_items(service, target_top_level_query_inv, fields="files(id, name)")

                if target_category_folders_inv is None:
                     print("נכשל ברישום תיקיות קטגוריה ביעד לצורך יצירת מלאי.", file=sys.stderr)
                elif not target_category_folders_inv:
                     print("לא נמצאו תיקיות קטגוריה ביעד ליצירת מלאי.")
                else:
                    print(f"נמצאו {len(target_category_folders_inv)} קטגוריות יעד. סורק כל אחת...")
                    for target_category_inv in target_category_folders_inv:
                        category_id_inv = target_category_inv.get('id'); category_name_inv = target_category_inv.get('name')
                        if not category_id_inv or not category_name_inv: continue
                        # Suppress category_id
                        print(f"\nסורק קטגוריה: '{category_name_inv}' (ID מוסתר)")
                        # Start inventory scan within this category
                        inventory_target_folder(service, category_id_inv, csv_writer, inventory_serial_counter, "", category_name_inv) # Pass category_name as the top-level context

                print(f"\nיצירת המלאי הושלמה. נמצאו {inventory_serial_counter[0]} קבצים. קובץ CSV נשמר ב-'{CSV_OUTPUT_FILENAME}'.")
        except IOError as e:
             print(f"קריטי: שגיאה בכתיבת קובץ CSV של המלאי '{CSV_OUTPUT_FILENAME}': {e}", file=sys.stderr); sys.exit(1)
        except Exception as e:
             print(f"קריטי: שגיאה בלתי צפויה במהלך יצירת קובץ CSV של המלאי: {e}", file=sys.stderr); traceback.print_exc(file=sys.stderr); sys.exit(1)

        print("\n--- סקריפט סנכרון ויצירת מלאי הסתיים בהצלחה ---")

    except HttpError as error:
        print(f'\nקריטי: אירעה שגיאת API במהלך העיבוד הראשי: {error}', file=sys.stderr)
        status_code = getattr(error, 'resp', None) and getattr(error.resp, 'status', None)
        if status_code:
             print(f"קוד סטטוס HTTP: {status_code}", file=sys.stderr)
             if status_code == 403:
                  print("הצעה: בדוק מכסות/הרשאות Drive API או אם טווח ההרשאות של הטוקן מספיק (כולל הרשאות מחיקה אם נדרש).", file=sys.stderr)
             elif status_code == 404:
                  print("הצעה: ודא שמזהי התיקיות (Folder IDs) נכונים ונגישים.", file=sys.stderr)
             elif status_code == 429:
                   print("הצעה: הפחת את תדירות ההרצות או יישם backoff אגרסיבי יותר.", file=sys.stderr)
        content = getattr(error, 'content', None)
        if content:
             try: print(f"תוכן התגובה: {content.decode()}", file=sys.stderr)
             except: print(f"תוכן התגובה (raw): {content}", file=sys.stderr)
        else: print("אין תוכן תגובה מפורט זמין.", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\nקריטי: אירעה שגיאה כללית בלתי צפויה: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    run_sync_and_inventory()