#!/bin/bash

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 BASE_DIRECTORY"
    echo "Example:"
    echo "  $0 /path/to/base"
    exit 1
fi

BASE_DIRECTORY=$1
INPUT_TSV_FILE="$BASE_DIRECTORY/loss-scenarios.tsv"
OUTPUT_HTML_FILE="$BASE_DIRECTORY/loss-scenario.html"

if [ ! -f "$INPUT_TSV_FILE" ]; then
    echo "Error: File '$INPUT_TSV_FILE' not found."
    exit 1
fi

mkdir -p "$(dirname $OUTPUT_HTML_FILE)"

cat <<EOL > "$OUTPUT_HTML_FILE"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TSV to HTML</title>
</head>
<body>
EOL

while IFS= read -r line; do
    echo "<p>$line</p>" >> "$OUTPUT_HTML_FILE"
done < "$INPUT_TSV_FILE"

# Close the HTML tags
cat <<EOL >> "$OUTPUT_HTML_FILE"
</body>
</html>
EOL

echo "HTML file '$OUTPUT_HTML_FILE' generated successfully."
