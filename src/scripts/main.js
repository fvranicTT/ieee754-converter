// Convert number to binary string with specified bits
function toBinaryString(num, bits) {
    return num.toString(2).padStart(bits, '0').slice(-bits);
}

// Convert bits to binary string with specified width
function bitsToBinaryString(bits, width) {
    return bits.toString(2).padStart(width, '0');
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

// Main conversion function
function convert() {
    let input = parseFloat(document.getElementById('input').value);
    if (isNaN(input)) {
        alert("Please enter a valid number");
        return;
    }
    
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

    // Float32 output
    document.getElementById('float32').innerHTML = `
        <div class="result-item">
            <strong>Float32 (32 bits):</strong><br>
            ${formatBinary(toBinaryString(float32Bits, 32), 8, 23)}<br>
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

    // Bfloat16 output
    document.getElementById('bfloat16').innerHTML = `
        <div class="result-item">
            <strong>Bfloat16 (16 bits):</strong><br>
            ${formatBinary(toBinaryString(bfloat16Bits, 16), 8, 7)}<br>
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

    // TF32 output
    document.getElementById('tf32').innerHTML = `
        <div class="result-item">
            <strong>TF32 (19 bits):</strong><br>
            ${formatBinary(toBinaryString(tf32Bits, 19), 8, 10)}<br>
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

    // Float16 output
    document.getElementById('float16').innerHTML = `
        <div class="result-item">
            <strong>Float16 (16 bits):</strong><br>
            ${formatBinary(toBinaryString(float16Bits, 16), 5, 10)}<br>
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
}