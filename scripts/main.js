// Convert number to binary string with specified bits
function toBinaryString(num, bits) {
    // Ensure the number is treated as unsigned
    const unsignedNum = num >>> 0;
    return unsignedNum.toString(2).padStart(bits, '0').slice(-bits);
}

// Convert number to hex string, handling different bit widths
function toHexString(num, bits) {
    // Calculate padding based on bit length (4 bits per hex digit)
    const hexDigits = Math.ceil(bits / 4);
    return num.toString(16).toUpperCase().padStart(hexDigits, '0');
}

// Format binary string with colored bit boxes
function formatBinary(binary, expBits, mantissaBits) {
    let sign = `<span class='bit-box sign'>${binary[0]}</span>`;
    let exponent = binary.slice(1, 1 + expBits).split('').map(bit => `<span class='bit-box exponent'>${bit}</span>`).join('');
    let mantissa = binary.slice(1 + expBits).split('').map(bit => `<span class='bit-box mantissa'>${bit}</span>`).join('');
    return `<div class='bit-container'>${sign}${exponent}${mantissa}</div>`;
}

// Convert Float32 to Bfloat16
function floatToBfloat16(value) {
    let floatView = new Float32Array([value]);
    let intView = new Uint32Array(floatView.buffer);
    return (intView[0] >>> 16) & 0xFFFF;
}

// Convert Bfloat16 bits back to Float32
function bfloat16ToFloat32(bfloat16Bits) {
    let intView = new Uint32Array(1);
    intView[0] = (bfloat16Bits & 0xFFFF) << 16;
    let floatView = new Float32Array(intView.buffer);
    return floatView[0];
}

// Convert Float32 to TF32
function floatToTF32(value) {
    let floatView = new Float32Array([value]);
    let intView = new Uint32Array(floatView.buffer);
    let floatBits = intView[0];

    let sign = (floatBits >>> 31) & 0x1;
    let exponent = (floatBits >>> 23) & 0xFF;
    let mantissa = floatBits & 0x7FFFFF;

    // Truncate mantissa to 10 bits (shift right by 13)
    mantissa = (mantissa >>> 13) & 0x3FF;

    // Handle special cases
    if (exponent === 0xFF) {
        return (sign << 18) | (0xFF << 10) | (mantissa !== 0 ? 0x200 : 0);
    }

    if (exponent === 0) {
        return (sign << 18) | mantissa;
    }

    return (sign << 18) | (exponent << 10) | mantissa;
}

// Convert TF32 bits back to Float32
function tf32ToFloat32(tf32Bits) {
    let sign = (tf32Bits >>> 18) & 0x1;
    let exponent = (tf32Bits >>> 10) & 0xFF;
    let mantissa = tf32Bits & 0x3FF;

    let intView = new Uint32Array(1);
    intView[0] = (sign << 31) | (exponent << 23) | (mantissa << 13);
    let floatView = new Float32Array(intView.buffer);
    return floatView[0];
}

// Convert Float32 to Float16 (FP16)
function floatToFloat16(value) {
    let floatView = new Float32Array([value]);
    let intView = new Uint32Array(floatView.buffer);
    let f = intView[0];

    let sign = (f >>> 31) & 0x1;
    let exponent = (f >>> 23) & 0xFF;
    let mantissa = f & 0x7FFFFF;

    let halfSign = sign << 15;
    let halfExp = 0;
    let halfMant = 0;

    if (exponent === 0xFF) {
        // Infinity or NaN
        halfExp = 0x1F << 10;
        halfMant = mantissa !== 0 ? (mantissa >>> 13) & 0x3FF : 0;
    } else if (exponent === 0) {
        // Zero or subnormal
        return halfSign;
    } else {
        // Normal number
        let newExp = exponent - 127 + 15; // Adjust bias
        if (newExp >= 31) {
            // Overflow to infinity
            halfExp = 0x1F << 10;
        } else if (newExp <= 0) {
            // Subnormal or underflow
            let shift = 1 - newExp;
            mantissa = (mantissa | 0x800000) >>> (shift - 1);
            halfMant = (mantissa >>> 13) & 0x3FF;
            if (halfMant === 0) return halfSign;
        } else {
            // Normal Float16
            halfExp = newExp << 10;
            halfMant = (mantissa >>> 13) & 0x3FF;
        }
    }

    return halfSign | halfExp | halfMant;
}

// Convert Float16 bits back to Float32
function float16ToFloat32(float16Bits) {
    let sign = (float16Bits & 0x8000) << 16;
    let exponent = (float16Bits & 0x7C00) >> 10;
    let mantissa = float16Bits & 0x03FF;

    if (exponent === 0) {
        if (mantissa === 0) {
            return new Float32Array(new Uint32Array([sign]).buffer)[0];
        }
        let shift = 0;
        while ((mantissa & 0x0400) === 0) {
            mantissa <<= 1;
            shift++;
        }
        exponent = 1 - shift;
        mantissa &= 0x3FF;
    } else if (exponent === 0x1F) {
        return new Float32Array(new Uint32Array([sign | 0x7F800000 | (mantissa << 13)]).buffer)[0];
    }

    exponent = (exponent + (127 - 15));
    let intView = new Uint32Array(1);
    intView[0] = sign | (exponent << 23) | (mantissa << 13);
    return new Float32Array(intView.buffer)[0];
}

function floatToFP8E5M2(value) {
    let floatView = new Float32Array([value]);
    let intView = new Uint32Array(floatView.buffer);
    let floatBits = intView[0];

    let sign = (floatBits >>> 31) & 0x1;
    let exponent = (floatBits >>> 23) & 0xFF;
    let mantissa = floatBits & 0x7FFFFF;

    // Adjust exponent bias from 127 (FP32) to 15 (FP8 E5M2)
    let newExp = exponent - 127 + 15;

    if (exponent === 0xFF) {
        // Handle special cases (Infinity/NaN)
        return (sign << 7) | (0x1F << 2) | (mantissa !== 0 ? 0x1 : 0);
    }

    if (newExp <= 0) {
        // Subnormal or zero
        return sign << 7;
    }

    if (newExp >= 31) {
        // Overflow to infinity
        return (sign << 7) | (0x1F << 2);
    }

    // Normalized number
    return (sign << 7) | (newExp << 2) | ((mantissa >>> 21) & 0x3);
}

function fp8E5M2ToFloat(fp8Bits) {
    let sign = (fp8Bits >>> 7) & 0x1;
    let exponent = (fp8Bits >>> 2) & 0x1F;
    let mantissa = fp8Bits & 0x3;

    if (exponent === 0x1F) {
        // Infinity or NaN
        return sign ? -Infinity : Infinity;
    }

    if (exponent === 0) {
        // Subnormal or zero
        return sign ? -0 : 0;
    }

    // Normalized number
    let newExp = exponent - 15 + 127; // Adjust bias back to FP32
    let intView = new Uint32Array(1);
    intView[0] = (sign << 31) | (newExp << 23) | (mantissa << 21);
    let floatView = new Float32Array(intView.buffer);
    return floatView[0];
}

function floatToFP8E4M3(value) {
    let floatView = new Float32Array([value]);
    let intView = new Uint32Array(floatView.buffer);
    let floatBits = intView[0];

    let sign = (floatBits >>> 31) & 0x1;
    let exponent = (floatBits >>> 23) & 0xFF;
    let mantissa = floatBits & 0x7FFFFF;

    // Adjust exponent bias from 127 (FP32) to 7 (FP8 E4M3)
    let newExp = exponent - 127 + 7;

    if (exponent === 0xFF) {
        // Handle special cases (Infinity/NaN)
        return (sign << 7) | (0xF << 3) | (mantissa !== 0 ? 0x1 : 0);
    }

    if (newExp <= 0) {
        // Subnormal or zero
        return sign << 7;
    }

    if (newExp >= 15) {
        // Overflow to infinity
        return (sign << 7) | (0xF << 3);
    }

    // Normalized number
    return (sign << 7) | (newExp << 3) | ((mantissa >>> 20) & 0x7);
}

function fp8E4M3ToFloat(fp8Bits) {
    let sign = (fp8Bits >>> 7) & 0x1;
    let exponent = (fp8Bits >>> 3) & 0xF;
    let mantissa = fp8Bits & 0x7;

    if (exponent === 0xF) {
        // Infinity or NaN
        return sign ? -Infinity : Infinity;
    }

    if (exponent === 0) {
        // Subnormal or zero
        return sign ? -0 : 0;
    }

    // Normalized number
    let newExp = exponent - 7 + 127; // Adjust bias back to FP32
    let intView = new Uint32Array(1);
    intView[0] = (sign << 31) | (newExp << 23) | (mantissa << 20);
    let floatView = new Float32Array(intView.buffer);
    return floatView[0];
}

// Calculate loss between original and converted values
function calculateLoss(original, converted) {
    if (!isFinite(original) || !isFinite(converted)) {
        if (original === converted) return "0.0000000000";
        if (isNaN(original) || isNaN(converted)) return "NaN";
        return "Infinity";
    }
    return Math.abs(original - converted).toFixed(10);
}

// Format number to 10 decimal places, handling special cases
function formatDecimal(num) {
    if (!isFinite(num)) {
        return String(num);
    }
    return num.toFixed(10);
}

function hideElements(ids) {
    ids.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'none';
        }
    });
}

function showElements(ids) {
    ids.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'block';
        }
    });
}

// Main conversion function
function convertFloatToHex() {
    let input = parseFloat(document.getElementById('input').value);
    if (isNaN(input)) {
        alert("Please enter a valid number");
        return;
    }

    // Hide integer elements
    hideElements(['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32']);

    // Float32: Ensure the actual Float32 representation is used
    let float32Val = new Float32Array([input])[0];
    let float32Bits = new Uint32Array(new Float32Array([input]).buffer)[0];

    // Bfloat16
    let bfloat16Bits = floatToBfloat16(input);
    let bfloat16Val = bfloat16ToFloat32(bfloat16Bits);

    // TF32
    let tf32Bits = floatToTF32(input);
    let tf32Val = tf32ToFloat32(tf32Bits);

    // Float16
    let float16Bits = floatToFloat16(input);
    let float16Val = float16ToFloat32(float16Bits);

    // FP8 E5M2
    let fp8E5M2Bits = floatToFP8E5M2(input);
    let fp8E5M2Val = fp8E5M2ToFloat(fp8E5M2Bits);

    // FP8 E4M3
    let fp8E4M3Bits = floatToFP8E4M3(input);
    let fp8E4M3Val = fp8E4M3ToFloat(fp8E4M3Bits);

    // Float32 output
    document.getElementById('float32').innerHTML = `
        <div class="result-item">
            <strong>Float32 (32 bits):</strong><br><br>
            ${formatBinary(toBinaryString(float32Bits, 32), 8, 23)}
            <strong>Binary:</strong><br>
            <div class="binary">${toBinaryString(float32Bits, 32)}</div><br>
            <strong>Hex:</strong><br>
            <div class="hex-representation">0x${toHexString(float32Bits, 32)}</div><br>
            <strong>Decimal Representation:</strong> ${formatDecimal(input)}<br>
            <strong>Value Stored:</strong> ${formatDecimal(float32Val)}<br>
            <strong>Error:</strong> ${calculateLoss(input, float32Val)}
            <div class="bit-info">
                <span><strong>Sign:</strong> 1 bit</span>
                <span><strong>Exponent:</strong> 8 bits</span>
                <span><strong>Mantissa:</strong> 23 bits</span>
            </div>
        </div>
    `;

    // TF32 output
    document.getElementById('tf32').innerHTML = `
    <div class="result-item">
        <strong>TF32 (19 bits):</strong><br><br>
        ${formatBinary(toBinaryString(tf32Bits, 19), 8, 10)}
        <strong>Binary:</strong><br>
        <div class="binary">${toBinaryString(tf32Bits, 19)}</div><br>
        <strong>Hex:</strong><br>
        <div class="hex-representation">0x${toHexString(tf32Bits, 19)}</div><br>
        <strong>Decimal Representation:</strong> ${formatDecimal(input)}<br>
        <strong>Value Stored:</strong> ${formatDecimal(tf32Val)}<br>
        <strong>Error:</strong> ${calculateLoss(input, tf32Val)}
        <div class="bit-info">
            <span><strong>Sign:</strong> 1 bit</span>
            <span><strong>Exponent:</strong> 8 bits</span>
            <span><strong>Mantissa:</strong> 10 bits</span>
        </div>
    </div>
    `;

    // Bfloat16 output
    document.getElementById('bfloat16').innerHTML = `
        <div class="result-item">
            <strong>Bfloat16 (16 bits):</strong><br><br>
            ${formatBinary(toBinaryString(bfloat16Bits, 16), 8, 7)}
            <strong>Binary:</strong><br>
            <div class="binary">${toBinaryString(bfloat16Bits, 16)}</div><br>
            <strong>Hex:</strong><br>
            <div class="hex-representation">0x${toHexString(bfloat16Bits, 16)}</div><br>
            <strong>Decimal Representation:</strong> ${formatDecimal(input)}<br>
            <strong>Value Stored:</strong> ${formatDecimal(bfloat16Val)}<br>
            <strong>Error:</strong> ${calculateLoss(input, bfloat16Val)}
            <div class="bit-info">
                <span><strong>Sign:</strong> 1 bit</span>
                <span><strong>Exponent:</strong> 8 bits</span>
                <span><strong>Mantissa:</strong> 7 bits</span>
            </div>
        </div>
    `;

    // Float16 output
    document.getElementById('float16').innerHTML = `
        <div class="result-item">
            <strong>Float16 (16 bits):</strong><br><br>
            ${formatBinary(toBinaryString(float16Bits, 16), 5, 10)}
            <strong>Binary:</strong><br>
            <div class="binary">${toBinaryString(float16Bits, 16)}</div><br>
            <strong>Hex:</strong><br>
            <div class="hex-representation">0x${toHexString(float16Bits, 16)}</div><br>
            <strong>Decimal Representation:</strong> ${formatDecimal(input)}<br>
            <strong>Value Stored:</strong> ${formatDecimal(float16Val)}<br>
            <strong>Error:</strong> ${calculateLoss(input, float16Val)}
            <div class="bit-info">
                <span><strong>Sign:</strong> 1 bit</span>
                <span><strong>Exponent:</strong> 5 bits</span>
                <span><strong>Mantissa:</strong> 10 bits</span>
            </div>
        </div>
    `;

    document.getElementById('fp8-e5m2').innerHTML = `
        <div class="result-item">
            <strong>FP8 E5M2 (8 bits):</strong><br><br>
            ${formatBinary(toBinaryString(fp8E5M2Bits, 8), 5, 2)}
            <strong>Binary:</strong><br>
            <div class="binary">${toBinaryString(fp8E5M2Bits, 8)}</div><br>
            <strong>Hex:</strong><br>
            <div class="hex-representation">0x${toHexString(fp8E5M2Bits, 8)}</div><br>
            <strong>Decimal Representation:</strong> ${formatDecimal(fp8E5M2Val)}<br>
            <strong>Value Stored:</strong> ${formatDecimal(fp8E5M2Val)}<br>
            <strong>Error:</strong> ${calculateLoss(input, fp8E5M2Val)}
            <div class="bit-info">
                <span><strong>Sign:</strong> 1 bit</span>
                <span><strong>Exponent:</strong> 5 bits</span>
                <span><strong>Mantissa:</strong> 2 bits</span>
            </div>
        </div>
    `;

    document.getElementById('fp8-e4m3').innerHTML = `
        <div class="result-item">
            <strong>FP8 E4M3 (8 bits):</strong><br><br>
            ${formatBinary(toBinaryString(fp8E4M3Bits, 8), 4, 3)}
            <strong>Binary:</strong><br>
            <div class="binary">${toBinaryString(fp8E4M3Bits, 8)}</div><br>
            <strong>Hex:</strong><br>
            <div class="hex-representation">0x${toHexString(fp8E4M3Bits, 8)}</div><br>
            <strong>Decimal Representation:</strong> ${formatDecimal(fp8E4M3Val)}<br>
            <strong>Value Stored:</strong> ${formatDecimal(fp8E4M3Val)}<br>
            <strong>Error:</strong> ${calculateLoss(input, fp8E4M3Val)}
            <div class="bit-info">
                <span><strong>Sign:</strong> 1 bit</span>
                <span><strong>Exponent:</strong> 4 bits</span>
                <span><strong>Mantissa:</strong> 3 bits</span>
            </div>
        </div>
    `;
}

// Format integer binary string with green bit boxes
function formatIntegerBinary(binary) {
    let bits = binary.split('').map(bit => `<span class='bit-box integer'>${bit}</span>`).join('');
    return `<div class='bit-container'>${bits}</div>`;
}

// Convert hex to float and integer representations
function convertHexToFloat() {
    let hexInputElement = document.getElementById('hexInput');
    if (!hexInputElement) {
        alert("Hex input element not found");
        return;
    }

    let hexInput = hexInputElement.value.trim().replace(/^0x/i, '').toUpperCase();
    if (!/^[0-9A-F]+$/.test(hexInput)) {
        alert("Please enter a valid hexadecimal number");
        return;
    }

    showElements(['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32']);

    // Parse hex as a number (bits)
    let bits = parseInt(hexInput, 16);

    // Validate input length for each format
    let isValidFloat32 = hexInput.length <= 8; // Up to 8 hex digits
    let isValidFloat16 = hexInput.length <= 4; // Up to 4 hex digits
    let isValidBfloat16 = hexInput.length <= 4; // Up to 4 hex digits
    let isValidTF32 = hexInput.length <= 5; // Up to 5 hex digits
    let isValidInt16 = hexInput.length <= 4; // Up to 4 hex digits
    let isValidUint16 = hexInput.length <= 4; // Up to 4 hex digits
    let isValidInt8 = hexInput.length <= 2; // Up to 2 hex digits
    let isValidUint8 = hexInput.length <= 2; // Up to 2 hex digits
    let isValidInt32 = hexInput.length <= 8; // Up to 8 hex digits
    let isValidUint32 = hexInput.length <= 8; // Up to 8 hex digits
    let isValidFp8E5M2 = hexInput.length <= 2; // Up to 2 hex digits
    let isValidFp8E4M3 = hexInput.length <= 2; // Up to 2 hex digits

    // Float32 (32 bits, 8 hex digits)
    let float32Val = "Invalid";
    let float32Binary = "";
    if (isValidFloat32) {
        let float32Bits = bits & 0xFFFFFFFF;
        let floatView = new Float32Array(new Uint32Array([float32Bits]).buffer);
        float32Val = formatDecimal(floatView[0]);
        float32Binary = toBinaryString(float32Bits, 32);
    }

    // Float16 (16 bits, 4 hex digits)
    let float16Val = "Invalid";
    let float16Binary = "";
    if (isValidFloat16) {
        let float16Bits = bits & 0xFFFF;
        float16Val = formatDecimal(float16ToFloat32(float16Bits));
        float16Binary = toBinaryString(float16Bits, 16);
    }

    // Bfloat16 (16 bits, 4 hex digits)
    let bfloat16Val = "Invalid";
    let bfloat16Binary = "";
    if (isValidBfloat16) {
        let bfloat16Bits = bits & 0xFFFF;
        bfloat16Val = formatDecimal(bfloat16ToFloat32(bfloat16Bits));
        bfloat16Binary = toBinaryString(bfloat16Bits, 16);
    }

    // TF32 (19 bits, 5 hex digits)
    let tf32Val = "Invalid";
    let tf32Binary = "";
    if (isValidTF32) {
        let tf32Bits = bits & 0x7FFFF; // Mask to 19 bits
        tf32Val = formatDecimal(tf32ToFloat32(tf32Bits));
        tf32Binary = toBinaryString(tf32Bits, 19);
    }

    // Int16 (16 bits, 4 hex digits)
    let int16Val = "Invalid";
    let int16Binary = "";
    if (isValidInt16) {
        let int16Bits = (bits << 16) >> 16; // Sign-extend to 16 bits
        int16Val = int16Bits.toString();
        int16Binary = toBinaryString(int16Bits >>> 0, 16); // Unsigned for display
    }

    // Uint16 (16 bits, 4 hex digits)
    let uint16Val = "Invalid";
    let uint16Binary = "";
    if (isValidUint16) {
        let uint16Bits = bits & 0xFFFF; // Mask to 16 bits (unsigned)
        uint16Val = uint16Bits.toString();
        uint16Binary = toBinaryString(uint16Bits, 16);
    }

    // Int8 (8 bits, 2 hex digits)
    let int8Val = "Invalid";
    let int8Binary = "";
    if (isValidInt8) {
        let int8Bits = (bits << 24) >> 24; // Sign-extend to 8 bits
        int8Val = int8Bits.toString();
        int8Binary = toBinaryString(int8Bits >>> 0, 8); // Unsigned for display
    }

    // Uint8 (8 bits, 2 hex digits)
    let uint8Val = "Invalid";
    let uint8Binary = "";
    if (isValidUint8) {
        let uint8Bits = bits & 0xFF; // Mask to 8 bits (unsigned)
        uint8Val = uint8Bits.toString();
        uint8Binary = toBinaryString(uint8Bits, 8);
    }

    // Int32 (32 bits, 8 hex digits)
    let int32Val = "Invalid";
    let int32Binary = "";
    if (isValidInt32) {
        let int32Bits = bits | 0; // Convert to signed 32-bit integer
        int32Val = int32Bits.toString();
        int32Binary = toBinaryString(int32Bits >>> 0, 32); // Unsigned for display
    }

    // Uint32 (32 bits, 8 hex digits)
    let uint32Val = "Invalid";
    let uint32Binary = "";
    if (isValidUint32) {
        let uint32Bits = bits >>> 0; // Convert to unsigned 32-bit integer
        uint32Val = uint32Bits.toString();
        uint32Binary = toBinaryString(uint32Bits, 32);
    }

    // FP8 E5M2 (8 bits, 2 hex digits)
    let fp8E5M2Val = "Invalid";
    let fp8E5M2Binary = "";
    if (isValidFp8E5M2) {
        let fp8E5M2Bits = bits & 0xFF; // Mask to 8 bits
        fp8E5M2Val = formatDecimal(fp8E5M2ToFloat(fp8E5M2Bits));
        fp8E5M2Binary = toBinaryString(fp8E5M2Bits, 8);
    }

    // FP8 E4M3 (8 bits, 2 hex digits)
    let fp8E4M3Val = "Invalid";
    let fp8E4M3Binary = "";
    if (isValidFp8E4M3) {
        let fp8E4M3Bits = bits & 0xFF; // Mask to 8 bits
        fp8E4M3Val = formatDecimal(fp8E4M3ToFloat(fp8E4M3Bits));
        fp8E4M3Binary = toBinaryString(fp8E4M3Bits, 8);
    }

    document.getElementById('float32').innerHTML = `
        <div class="result-item">
            <strong>Float32 (32 bits):</strong><br><br>
            ${isValidFloat32 ? formatBinary(float32Binary, 8, 23) : ""}
            <strong>Binary:</strong><br>
            <div class="binary">${float32Binary}</div><br>
            <strong>Hex:</strong><br>
            <div class="hex-representation">${isValidFloat32 ? `0x${hexInput}` : ""}</div><br>
            <strong>Floating Point Value:</strong> ${float32Val}
            <div class="bit-info">
                <span><strong>Sign:</strong> 1 bit</span>
                <span><strong>Exponent:</strong> 8 bits</span>
                <span><strong>Mantissa:</strong> 23 bits</span>
            </div>
        </div>
    `;

    document.getElementById('tf32').innerHTML = `
        <div class="result-item">
            <strong>TF32 (19 bits):</strong><br><br>
            ${isValidTF32 ? formatBinary(tf32Binary, 8, 10) : ""}
            <strong>Binary:</strong><br>
            <div class="binary">${tf32Binary}</div><br>
            <div class="hex-representation">${isValidTF32 ? `0x${hexInput}` : ""}</div><br>
            <strong>Floating Point Value:</strong> ${tf32Val}
            <div class="bit-info">
                <span><strong>Sign:</strong> 1 bit</span>
                <span><strong>Exponent:</strong> 8 bits</span>
                <span><strong>Mantissa:</strong> 10 bits</span>
            </div>
        </div>
    `;

    document.getElementById('float16').innerHTML = `
        <div class="result-item">
            <strong>Float16 (16 bits):</strong><br><br>
            ${isValidFloat16 ? formatBinary(float16Binary, 5, 10) : ""}
            <strong>Binary:</strong><br>
            <div class="binary">${float16Binary}</div><br>
            <strong>Hex:</strong><br>
            <div class="hex-representation">${isValidFloat16 ? `0x${hexInput}` : ""}</div><br>
            <strong>Floating Point Value:</strong> ${float16Val}
            <div class="bit-info">
                <span><strong>Sign:</strong> 1 bit</span>
                <span><strong>Exponent:</strong> 8 bits</span>
                <span><strong>Mantissa:</strong> 23 bits</span>
            </div>
        </div>
    `;

    document.getElementById('bfloat16').innerHTML = `
        <div class="result-item">
            <strong>Bfloat16 (16 bits):</strong><br><br>
            ${isValidBfloat16 ? formatBinary(bfloat16Binary, 8, 7) : ""}
            <strong>Binary:</strong><br>
            <div class="binary">${bfloat16Binary}</div><br>
            <strong>Hex:</strong><br>
            <div class="hex-representation">${isValidBfloat16 ? `0x${hexInput}` : ""}</div><br>
            <strong>Floating Point Value:</strong> ${bfloat16Val}
            <div class="bit-info">
                <span><strong>Sign:</strong> 1 bit</span>
                <span><strong>Exponent:</strong> 8 bits</span>
                <span><strong>Mantissa:</strong> 7 bits</span>
            </div>
        </div>
    `;

    document.getElementById('fp8-e5m2').innerHTML = `
        <div class="result-item">
            <strong>FP8 E5M2 (8 bits):</strong><br><br>
            ${isValidFp8E5M2 ? formatBinary(fp8E5M2Binary, 5, 2) : ""}
            <strong>Binary:</strong><br>
            <div class="binary">${fp8E5M2Binary}</div><br>
            <strong>Hex:</strong><br>
            <div class="hex-representation">${isValidFp8E5M2 ? `0x${hexInput}` : ""}</div><br>
            <strong>Floating Point Value:</strong> ${fp8E5M2Val}
            <div class="bit-info">
                <span><strong>Sign:</strong> 1 bit</span>
                <span><strong>Exponent:</strong> 5 bits</span>
                <span><strong>Mantissa:</strong> 2 bits</span>
            </div>
        </div>
    `;

    document.getElementById('fp8-e4m3').innerHTML = `
        <div class="result-item">
            <strong>FP8 E4M3 (8 bits):</strong><br><br>
            ${isValidFp8E4M3 ? formatBinary(fp8E4M3Binary, 4, 3) : ""}
            <strong>Binary:</strong><br>
            <div class="binary">${fp8E4M3Binary}</div><br>
            <strong>Hex:</strong><br>
            <div class="hex-representation">${isValidFp8E4M3 ? `0x${hexInput}` : ""}</div><br>
            <strong>Floating Point Value:</strong> ${fp8E4M3Val}
            <div class="bit-info">
                <span><strong>Sign:</strong> 1 bit</span>
                <span><strong>Exponent:</strong> 4 bits</span>
                <span><strong>Mantissa:</strong> 3 bits</span>
            </div>
        </div>
    `;

    document.getElementById('int8').innerHTML = `
        <div class="result-item">
            <strong>Int8 (8 bits):</strong><br><br>
            ${isValidInt8 ? formatIntegerBinary(int8Binary) : ""}
            <strong>Binary:</strong><br>
            <div class="binary">${int8Binary}</div><br>
            <strong>Hex:</strong><br>
            <div class="hex-representation">0x${isValidInt8 ? hexInput : ""}</div><br>
            <strong>Integer Value:</strong> ${int8Val}
            <div class="bit-info">
                <span><strong>Bits:</strong> 8 bits (signed)</span>
            </div>
        </div>
    `;

    document.getElementById('uint8').innerHTML = `
        <div class="result-item">
            <strong>Uint8 (8 bits):</strong><br><br>
            ${isValidUint8 ? formatIntegerBinary(uint8Binary) : ""}
            <strong>Binary:</strong><br>
            <div class="binary">${uint8Binary}</div><br>
            <strong>Hex:</strong><br>
            <div class="hex-representation">0x${isValidUint8 ? hexInput : ""}</div><br>
            <strong>Integer Value:</strong> ${uint8Val}
            <div class="bit-info">
                <span><strong>Bits:</strong> 8 bits (unsigned)</span>
            </div>
        </div>
    `;

    document.getElementById('int16').innerHTML = `
        <div class="result-item">
            <strong>Int16 (16 bits):</strong><br><br>
            ${isValidInt16 ? formatIntegerBinary(int16Binary) : ""}
            <strong>Binary:</strong><br>
            <div class="binary">${int16Binary}</div><br>
            <strong>Hex:</strong><br>
            <div class="hex-representation">0x${isValidInt16 ? hexInput : ""}</div><br>
            <strong>Integer Value:</strong> ${int16Val}
            <div class="bit-info">
                <span><strong>Bits:</strong> 16 bits (signed)</span>
            </div>
        </div>
    `;

    document.getElementById('uint16').innerHTML = `
        <div class="result-item">
            <strong>Uint16 (16 bits):</strong><br><br>
            ${isValidUint16 ? formatIntegerBinary(uint16Binary) : ""}
            <strong>Binary:</strong><br>
            <div class="binary">${uint16Binary}</div><br>
            <strong>Hex:</strong><br>
            <div class="hex-representation">0x${isValidUint16 ? hexInput : ""}</div><br>
            <strong>Integer Value:</strong> ${uint16Val}
            <div class="bit-info">
                <span><strong>Bits:</strong> 16 bits (unsigned)</span>
            </div>
        </div>
    `;

    document.getElementById('int32').innerHTML = `
        <div class="result-item">
            <strong>Int32 (32 bits):</strong><br><br>
            ${isValidInt32 ? formatIntegerBinary(int32Binary) : ""}
            <strong>Binary:</strong><br>
            <div class="binary">${int32Binary}</div><br>
            <strong>Hex:</strong><br>
            <div class="hex-representation">0x${isValidInt32 ? hexInput : ""}</div><br>
            <strong>Integer Value:</strong> ${int32Val}
            <div class="bit-info">
                <span><strong>Bits:</strong> 32 bits (signed)</span>
            </div>
        </div>
    `;

    document.getElementById('uint32').innerHTML = `
        <div class="result-item">
            <strong>Uint32 (32 bits):</strong><br><br>
            ${isValidUint32 ? formatIntegerBinary(uint32Binary) : ""}
            <strong>Binary:</strong><br>
            <div class="binary">${uint32Binary}</div><br>
            <strong>Hex:</strong><br>
            <div class="hex-representation">0x${isValidUint32 ? hexInput : ""}</div><br>
            <strong>Integer Value:</strong> ${uint32Val}
            <div class="bit-info">
                <span><strong>Bits:</strong> 32 bits (unsigned)</span>
            </div>
        </div>
    `;
}
