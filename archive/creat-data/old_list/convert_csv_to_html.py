import csv

# Function to generate the HTML table header
def generate_table_header(columns):
    header = "<thead>\n<tr>\n"
    for column in columns:
        header += f"  <th>{column}</th>\n"
    header += "</tr>\n</thead>"
    return header

# Function to generate HTML table rows from CSV data
def generate_table_rows(data):
    rows = ""
    for row in data:
        rows += "<tr>\n"
        for item in row:
            rows += f"  <td>{item}</td>\n"
        rows += "</tr>\n"
    return rows

# Read data from the CSV file
with open('songs.csv', mode='r', encoding='utf-8') as csv_file:
    csv_reader = csv.reader(csv_file)
    
    # Read the header row
    header = next(csv_reader)
    
    # Read the remaining data
    data = list(csv_reader)

# Generate the HTML table header
table_header = generate_table_header(header)

# Generate the HTML table rows
table_rows = generate_table_rows(data)

# Create the complete HTML table
html_table = f"<table>\n{table_header}\n{table_rows}</table>"

# Print or save the HTML table as needed
# print(html_table)

with open('output.html', mode='w', encoding='utf-8') as html_file:
    html_file.write(html_table)
