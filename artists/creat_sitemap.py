import os
import xml.etree.ElementTree as ET
from xml.dom import minidom
from urllib.parse import urljoin, quote

def create_sitemap(directory, base_url, update_frequency, priority):
    # Create root element
    root = ET.Element("urlset")
    root.set("xmlns", "http://www.sitemaps.org/schemas/sitemap/0.9")

    # Iterate through HTML files in directory
    for filename in os.listdir(directory):
        if filename.endswith(".html"):
            loc = urljoin(base_url, quote(filename, safe=''))
            url = ET.SubElement(root, "url")
            loc_elem = ET.SubElement(url, "loc")
            loc_elem.text = loc
            lastmod_elem = ET.SubElement(url, "lastmod")  # You can add last modified date if needed
            lastmod_elem.text = "2024-02-27"  # Placeholder for demonstration
            changefreq_elem = ET.SubElement(url, "changefreq")
            changefreq_elem.text = update_frequency
            priority_elem = ET.SubElement(url, "priority")
            priority_elem.text = str(priority)

    # Create XML tree
    tree = ET.ElementTree(root)

    # Save XML to file
    tree.write("sitemap.xml", encoding="utf-8", xml_declaration=True)

    # Beautify XML (optional)
    xml_str = minidom.parseString(ET.tostring(root)).toprettyxml(indent="    ")
    with open("sitemap-artists.xml", "w") as f:
        f.write(xml_str)

# Set parameters
directory = r"C:\Users\משתמש\Documents\GitHub\shir-bot\artists\list"  # Change this to the directory containing your HTML files
base_url = "https://nhlocal.github.io/shir-bot/artists/list/"
update_frequency = "monthly"
priority = 0.7

# Create sitemap
create_sitemap(directory, base_url, update_frequency, priority)
