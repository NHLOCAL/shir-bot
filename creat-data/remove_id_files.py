import csv

# Define the input and output filenames
input_filename = 'output.csv'
output_filename = 'songs.csv'

# Open the input CSV file for reading and the output CSV file for writing
with open(input_filename, 'r', encoding='utf-8') as input_file, open(output_filename, 'w', newline='', encoding='utf-8') as output_file:
    reader = csv.reader(input_file)
    writer = csv.writer(output_file)
    
    # Iterate through each row in the input CSV
    for row in reader:
        # Exclude the fifth column by slicing the row
        new_row = row[:4]  # Assuming the index is zero-based
        
        # Write the modified row to the output CSV
        writer.writerow(new_row)

print("New CSV file without the fifth column has been created!")
