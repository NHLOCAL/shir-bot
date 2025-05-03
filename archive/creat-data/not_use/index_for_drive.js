const { google } = require('googleapis');
const fs = require('fs');

// Function to authorize and create a client instance
async function authorize() {
  const credentials = JSON.parse(fs.readFileSync("C:\Users\משתמש\Videos\service-account-file.json"));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  const token = JSON.parse(fs.readFileSync('token.json'));
  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

// Function to list files in a folder
async function listFiles(auth, folderId) {
  const drive = google.drive({ version: 'v3', auth });
  let files = [];

  const response = await drive.files.list({
    q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder'`,
    fields: 'nextPageToken, files(id, name, parents)',
  });

  files = response.data.files;
  return files;
}

// Function to get the folder name by ID
async function getFolderName(auth, folderId) {
  const drive = google.drive({ version: 'v3', auth });
  const response = await drive.files.get({
    fileId: folderId,
    fields: 'name',
  });
  return response.data.name;
}

// Function to get the parent folder name by ID
async function getParentFolderName(auth, folderId) {
  const drive = google.drive({ version: 'v3', auth });
  const response = await drive.files.get({
    fileId: folderId,
    fields: 'parents',
  });

  if (response.data.parents && response.data.parents.length > 0) {
    const parentFolderId = response.data.parents[0];
    const parentResponse = await drive.files.get({
      fileId: parentFolderId,
      fields: 'name',
    });
    return parentResponse.data.name;
  } else {
    return '';
  }
}

// Main function to generate CSV file
async function generateCSVFile() {
  try {
    const auth = await authorize();

    const folderId = '1fPaCdEZquqAlB-eL56rbIn-RDF98xcut'; // Replace with the desired folder ID
    const files = await listFiles(auth, folderId);

    const csvData = [['Serial Number', 'Filename', 'Album Name', 'Singer Name', 'File ID']];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const serialNumber = i + 1;
      const filename = file.name;
      const albumName = await getFolderName(auth, file.parents[0]);
      const singerName = await getParentFolderName(auth, file.parents[0]);
      const fileId = file.id;
      csvData.push([serialNumber, filename, albumName, singerName, fileId]);
    }

    const csvContent = csvData.map((row) => row.join(',')).join('\n');
    fs.writeFileSync('file_list.csv', csvContent);
    console.log('CSV file generated successfully!');
  } catch (error) {
    console.error('Error generating CSV file:', error);
  }
}

generateCSVFile();
