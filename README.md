# IEEE 754 Floating Point Converter

This project is an IEEE 754 Floating Point Converter that allows users to convert floating-point numbers into various formats, including Float32, Float16, Bfloat16, and TF32. The converter provides a visual representation of the binary and hexadecimal values, along with the error in conversion.

## Project Structure

```
ieee754-converter
│
├── index.html        # Main HTML structure for the converter
│── styles
│   └── styles.css    # CSS styles for the project
│── scripts
│   └── main.js       # JavaScript functionality for the converter
└── README.md         # Project documentation
```

## Usage Instructions

1. Open `index.html` in a web browser.

2. **To convert a floating-point number to hex:**
   - Enter a floating-point number (e.g., `3.14`, `-0.5`, or `1e10`) in the **"Float Input"** field.
   - Click the **"Convert to Hex"** button.
   - The results will display the corresponding floating-point representations (e.g., `float32`, `float16`, `bfloat16`, `tf32`) along with their **binary** and **hexadecimal** formats.

3. **To convert a hexadecimal value to numeric formats:**
   - Enter a hexadecimal number (e.g., `40490fdb` or `3ff00`) in the **"Hex Input"** field.
   - Click the **"Convert from Hex"** button.
   - The output will show the interpreted **float32**, **float16**, **bfloat16** and relevant **integer representations** of the value.

## Implementation Details

- The project uses standard HTML, CSS, and JavaScript.
- The CSS file (`styles/styles.css`) contains all styling rules to ensure a clean and responsive design.
- The JavaScript file (`scripts/main.js`) handles the conversion logic, including functions for binary and hexadecimal formatting, as well as error calculation.

## License

This project is open-source and available for anyone to use and modify.
