import csv
import os
from googleapiclient.discovery import build
from google.oauth2 import service_account

# Set up Google Drive API credentials
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
SERVICE_ACCOUNT_FILE = r'C:\Users\משתמש\Videos\service-account-file.json'

# Define the folder ID for the desired folder in Google Drive
FOLDER_ID = '1sMGZLisLMAZKKeCVnkGREZbUW7aXst08'

def main():
    # Authenticate and create the Drive service
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )
    service = build('drive', 'v3', credentials=credentials)

    # Create a CSV file and write headers
    with open('output.csv', 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['Serial Number', 'Filename', 'Album', 'Singer', 'File ID'])

        # Initialize serial number counter
        serial_number = 1

        # Traverse folder and process files
        process_folder(service, writer, FOLDER_ID, serial_number)

    print('CSV file created successfully.')

def process_folder(service, writer, folder_id, serial_number, parent_folder_id=None):
    # Get all files in the current folder
    files = service.files().list(
        q=f"'{folder_id}' in parents and mimeType != 'application/vnd.google-apps.folder'",
        fields="files(id, name, parents)"
    ).execute()

    # Process files in the current folder
    for file in files['files']:
        filename = file['name']
        album = get_folder_name(service, file['parents'][0])
        singer = get_folder_name(service, file['parents'][0], True)
        file_id = file['id']

        writer.writerow([serial_number, filename, album, singer, file_id])
        serial_number += 1

    # Traverse subfolders recursively
    subfolders = service.files().list(
        q=f"'{folder_id}' in parents and mimeType = 'application/vnd.google-apps.folder'",
        fields="files(id)"
    ).execute()

    for subfolder in subfolders['files']:
        serial_number = process_folder(service, writer, subfolder['id'], serial_number, folder_id)

    return serial_number

def get_folder_name(service, folder_id, is_singer=False):
    # Retrieve folder metadata
    folder = service.files().get(fileId=folder_id, fields='name, parents').execute()
    folder_name = folder['name']

    if is_singer:
        # Check if the folder has a parent
        if 'parents' in folder:
            parent_folder_id = folder['parents'][0]
            return get_folder_name(service, parent_folder_id, True)
        else:
            return folder_name
    else:
        return folder_name

if __name__ == '__main__':
    main()
