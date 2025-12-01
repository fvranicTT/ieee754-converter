// Convert number to binary string with specified bits
function toBinaryString(num, bits) {
  // Use >>> 0 to ensure unsigned 32-bit conversion (handles negative numbers)
  return (num >>> 0).toString(2).padStart(bits, '0');
}

// Convert number to hex string, handling different bit widths
function toHexString(num, bits) {
  // Use >>> 0 to ensure unsigned 32-bit conversion (handles negative numbers)
  const hexDigits = Math.ceil(bits / 4);
  return (num >>> 0).toString(16).toUpperCase().padStart(hexDigits, '0');
}

// Format binary string with colored bit boxes
function formatBinary(binary, expBits, mantissaBits) {
  let sign = `<span class='bit-box sign'>${binary[0]}</span>`;
  let exponent = binary.slice(1, 1 + expBits)
                     .split('')
                     .map(bit => `<span class='bit-box exponent'>${bit}</span>`)
                     .join('');
  let mantissa = binary.slice(1 + expBits)
                     .split('')
                     .map(bit => `<span class='bit-box mantissa'>${bit}</span>`)
                     .join('');
  return `<div class='bit-container'>${sign}${exponent}${mantissa}</div>`;
}

// Convert Float32 to Bfloat16
function floatToBfloat16(value) {
  let floatView = new Float32Array([value]);
  let intView = new Uint32Array(floatView.buffer);
  let floatBits = intView[0];

  let sign = (floatBits >>> 31) & 0x1;
  let exponent = (floatBits >>> 23) & 0xFF;
  let mantissa = floatBits & 0x7FFFFF;

  // Handle special cases
  if (exponent === 0xFF) {
    // Infinity or NaN
    return (sign << 15) | (0xFF << 7) | (mantissa !== 0 ? 0x40 : 0);
  }

  if (exponent === 0) {
    if (mantissa === 0) {
      // Zero
      return sign << 15;
    }
    // Normalize subnormal number
    let shift = Math.clz32(mantissa) - 8;
    mantissa = (mantissa << shift) & 0x7FFFFF;
    exponent = 1 - shift;
  }

  // Round the mantissa to 7 bits
  let roundBit = (mantissa >>> 15) & 1;
  let stickyBits = (mantissa & 0x7FFF) !== 0;
  mantissa = mantissa >>> 16;

  // Apply round-to-nearest-even
  if (roundBit && (stickyBits || (mantissa & 1))) {
    mantissa++;
    // Check for mantissa overflow
    if (mantissa === 0x80) {
      mantissa = 0;
      exponent++;
    }
  }

  // Check for exponent overflow
  if (exponent >= 0xFF) {
    return (sign << 15) | (0xFF << 7);  // Infinity
  }

  return (sign << 15) | (exponent << 7) | mantissa;
}

// Convert Bfloat16 bits back to Float32
function bfloat16ToFloat32(bfloat16Bits) {
  // BFloat16 is essentially the upper 16 bits of Float32
  // So we can simply shift left by 16 to get the Float32 representation
  let float32Bits = bfloat16Bits << 16;
  return new Float32Array(new Uint32Array([float32Bits]).buffer)[0];
}

// Convert Float32 to TF32
function floatToTF32(value) {
  let floatView = new Float32Array([value]);
  let intView = new Uint32Array(floatView.buffer);
  let floatBits = intView[0];

  let sign = (floatBits >>> 31) & 0x1;
  let exponent = (floatBits >>> 23) & 0xFF;
  let mantissa = floatBits & 0x7FFFFF;

  // Handle special cases
  if (exponent === 0xFF) {
    // Infinity or NaN
    return (sign << 18) | (0xFF << 10) | (mantissa !== 0 ? 0x200 : 0);
  }

  if (exponent === 0) {
    if (mantissa === 0) {
      // Zero
      return sign << 18;
    }
    // Normalize subnormal number
    let shift = Math.clz32(mantissa) - 8;
    mantissa = (mantissa << shift) & 0x7FFFFF;
    exponent = 1 - shift;
  }

  // Round the mantissa to 10 bits
  let roundBit = (mantissa >>> 12) & 1;
  let stickyBits = (mantissa & 0xFFF) !== 0;
  mantissa = mantissa >>> 13;

  // Apply round-to-nearest-even
  if (roundBit && (stickyBits || (mantissa & 1))) {
    mantissa++;
    // Check for mantissa overflow
    if (mantissa === 0x400) {
      mantissa = 0;
      exponent++;
    }
  }

  // Check for exponent overflow
  if (exponent >= 0xFF) {
    return (sign << 18) | (0xFF << 10);  // Infinity
  }

  return (sign << 18) | (exponent << 10) | mantissa;
}

// Convert TF32 bits back to Float32
function tf32ToFloat32(tf32Bits) {
  // TF32 is essentially Float32 with the lower 13 mantissa bits truncated
  // TF32: 1 sign + 8 exponent + 10 mantissa = 19 bits
  // Float32: 1 sign + 8 exponent + 23 mantissa = 32 bits
  // So we can simply shift left by 13 to get the Float32 representation
  let float32Bits = tf32Bits << 13;
  return new Float32Array(new Uint32Array([float32Bits]).buffer)[0];
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
    halfMant = mantissa !== 0 ? (mantissa >>> 13) | 0x200 :
                                0;  // Preserve NaN (ensure non-zero mantissa)
  } else if (exponent === 0) {
    // Handle subnormal Float32 input
    if (mantissa === 0) {
      // Zero
      return halfSign;
    }
    // Normalize the subnormal number
    let shift = Math.clz32(mantissa) - 8;
    mantissa = (mantissa << shift) & 0x7FFFFF;
    exponent = 1 - shift;

    // Now proceed with the conversion as if it were normalized
    let newExp = exponent - 127 + 15;
    if (newExp < -10) {
      // Too small, underflow to zero
      return halfSign;
    }
    // Generate subnormal Float16 with rounding
    mantissa = (mantissa | 0x800000);
    let shiftAmount = 14 - newExp;
    let roundBit = (mantissa >>> (shiftAmount - 1)) & 1;
    let stickyBits = (mantissa & ((1 << (shiftAmount - 1)) - 1)) !== 0;
    halfMant = (mantissa >>> shiftAmount) & 0x3FF;
    // Apply round-to-nearest-even
    if (roundBit && (stickyBits || (halfMant & 1))) {
      halfMant++;
      if (halfMant === 0x400) {
        // Overflow from subnormal to normal
        halfMant = 0;
        halfExp = 1 << 10;
      }
    }
  } else {
    // Normal number
    let newExp = exponent - 127 + 15;  // Adjust bias
    if (newExp >= 31) {
      // Overflow to infinity
      halfExp = 0x1F << 10;
    } else if (newExp <= 0) {
      // Result will be subnormal
      if (newExp < -10) {
        // Too small, underflow to zero
        return halfSign;
      }
      // Generate subnormal Float16 with rounding
      mantissa = (mantissa | 0x800000);
      let shiftAmount = 14 - newExp;
      let roundBit = (mantissa >>> (shiftAmount - 1)) & 1;
      let stickyBits = (mantissa & ((1 << (shiftAmount - 1)) - 1)) !== 0;
      halfMant = (mantissa >>> shiftAmount) & 0x3FF;
      // Apply round-to-nearest-even
      if (roundBit && (stickyBits || (halfMant & 1))) {
        halfMant++;
        if (halfMant === 0x400) {
          // Overflow from subnormal to normal
          halfMant = 0;
          halfExp = 1 << 10;
        }
      }
    } else {
      // Normal Float16 with rounding
      let roundBit = (mantissa >>> 12) & 1;
      let stickyBits = (mantissa & 0xFFF) !== 0;
      halfMant = (mantissa >>> 13) & 0x3FF;
      // Apply round-to-nearest-even
      if (roundBit && (stickyBits || (halfMant & 1))) {
        halfMant++;
        if (halfMant === 0x400) {
          // Mantissa overflow, increment exponent
          halfMant = 0;
          newExp++;
          if (newExp >= 31) {
            // Overflow to infinity
            return halfSign | (0x1F << 10);
          }
        }
      }
      halfExp = newExp << 10;
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
    return new Float32Array(
        new Uint32Array([sign | 0x7F800000 | (mantissa << 13)]).buffer)[0];
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

  // Handle special cases first
  if (exponent === 0xFF) {
    // Infinity or NaN
    return (sign << 7) | (0x1F << 2) | (mantissa !== 0 ? 0x1 : 0);
  }

  if (exponent === 0) {
    // Handle subnormal Float32 input
    if (mantissa === 0) {
      return sign << 7;  // Zero
    }
    // Normalize the subnormal number
    let shift = Math.clz32(mantissa) - 8;
    mantissa = (mantissa << shift) & 0x7FFFFF;
    exponent = 1 - shift;
  }

  // Adjust exponent bias from 127 (FP32) to 15 (FP8 E5M2)
  let newExp = exponent - 127 + 15;

  if (newExp >= 31) {
    // Overflow to infinity
    return (sign << 7) | (0x1F << 2);
  }

  if (newExp <= 0) {
    // Result will be subnormal or zero
    if (newExp < -2) {
      return sign << 7;  // Underflow to zero
    }
    // Generate subnormal FP8 with rounding
    mantissa = (mantissa | 0x800000);
    let shiftAmount = 22 - newExp;
    let roundBit = (mantissa >>> (shiftAmount - 1)) & 1;
    let stickyBits = (mantissa & ((1 << (shiftAmount - 1)) - 1)) !== 0;
    let fp8Mant = (mantissa >>> shiftAmount) & 0x3;
    // Apply round-to-nearest-even
    if (roundBit && (stickyBits || (fp8Mant & 1))) {
      fp8Mant++;
      if (fp8Mant === 0x4) {
        // Overflow from subnormal to normal
        return (sign << 7) | (1 << 2);
      }
    }
    return (sign << 7) | fp8Mant;
  }

  // Normal number with rounding
  let roundBit = (mantissa >>> 20) & 1;
  let stickyBits = (mantissa & 0xFFFFF) !== 0;
  let fp8Mant = (mantissa >>> 21) & 0x3;
  // Apply round-to-nearest-even
  if (roundBit && (stickyBits || (fp8Mant & 1))) {
    fp8Mant++;
    if (fp8Mant === 0x4) {
      // Mantissa overflow, increment exponent
      fp8Mant = 0;
      newExp++;
      if (newExp >= 31) {
        // Overflow to infinity
        return (sign << 7) | (0x1F << 2);
      }
    }
  }
  return (sign << 7) | (newExp << 2) | fp8Mant;
}

function fp8E5M2ToFloat(fp8Bits) {
  let sign = (fp8Bits >>> 7) & 0x1;
  let exponent = (fp8Bits >>> 2) & 0x1F;
  let mantissa = fp8Bits & 0x3;
  const mantissaBits = 2;

  if (exponent === 0x1F) {
    // Infinity or NaN
    if (mantissa !== 0) {
      return NaN;
    }
    return sign ? -Infinity : Infinity;
  }

  if (exponent === 0) {
    if (mantissa === 0) {
      // Zero
      return sign ? -0 : 0;
    }
    // Subnormal number: value = (-1)^sign * (mantissa/4) * 2^(-14) = mantissa *
    // 2^(-16) Find the position of the leading 1 bit to normalize
    let shift;
    if (mantissa & 0x2) {
      shift = 1;  // Leading 1 at bit 1 (MSB)
    } else {
      shift = 2;  // Leading 1 at bit 0 (LSB)
    }
    // New exponent: original subnormal exp is (1-15) = -14, then subtract shift
    // for normalization
    let newExp = (1 - 15) - shift + 127;
    // Remove the implicit leading 1, keep remaining (mantissaBits - shift) bits
    let remainingBits = mantissaBits - shift;
    let remainingMantissa = mantissa & ((1 << remainingBits) - 1);
    // Shift to Float32 mantissa position (MSB-aligned in 23-bit field)
    let float32MantissaShift = 23 - remainingBits;
    let intView = new Uint32Array(1);
    intView[0] = (sign << 31) | (newExp << 23) |
        (remainingMantissa << float32MantissaShift);
    return new Float32Array(intView.buffer)[0];
  }

  // Normalized number
  let newExp = exponent - 15 + 127;  // Adjust bias back to FP32
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

  // Handle special cases first
  if (exponent === 0xFF) {
    // Infinity or NaN
    return (sign << 7) | (0xF << 3) | (mantissa !== 0 ? 0x1 : 0);
  }

  if (exponent === 0) {
    // Handle subnormal Float32 input
    if (mantissa === 0) {
      return sign << 7;  // Zero
    }
    // Normalize the subnormal number
    let shift = Math.clz32(mantissa) - 8;
    mantissa = (mantissa << shift) & 0x7FFFFF;
    exponent = 1 - shift;
  }

  // Adjust exponent bias from 127 (FP32) to 7 (FP8 E4M3)
  let newExp = exponent - 127 + 7;

  if (newExp >= 15) {
    // Overflow to infinity
    return (sign << 7) | (0xF << 3);
  }

  if (newExp <= 0) {
    // Result will be subnormal or zero
    if (newExp < -3) {
      return sign << 7;  // Underflow to zero
    }
    // Generate subnormal FP8 with rounding
    mantissa = (mantissa | 0x800000);
    let shiftAmount = 21 - newExp;
    let roundBit = (mantissa >>> (shiftAmount - 1)) & 1;
    let stickyBits = (mantissa & ((1 << (shiftAmount - 1)) - 1)) !== 0;
    let fp8Mant = (mantissa >>> shiftAmount) & 0x7;
    // Apply round-to-nearest-even
    if (roundBit && (stickyBits || (fp8Mant & 1))) {
      fp8Mant++;
      if (fp8Mant === 0x8) {
        // Overflow from subnormal to normal
        return (sign << 7) | (1 << 3);
      }
    }
    return (sign << 7) | fp8Mant;
  }

  // Normal number with rounding
  let roundBit = (mantissa >>> 19) & 1;
  let stickyBits = (mantissa & 0x7FFFF) !== 0;
  let fp8Mant = (mantissa >>> 20) & 0x7;
  // Apply round-to-nearest-even
  if (roundBit && (stickyBits || (fp8Mant & 1))) {
    fp8Mant++;
    if (fp8Mant === 0x8) {
      // Mantissa overflow, increment exponent
      fp8Mant = 0;
      newExp++;
      if (newExp >= 15) {
        // Overflow to infinity
        return (sign << 7) | (0xF << 3);
      }
    }
  }
  return (sign << 7) | (newExp << 3) | fp8Mant;
}

function fp8E4M3ToFloat(fp8Bits) {
  let sign = (fp8Bits >>> 7) & 0x1;
  let exponent = (fp8Bits >>> 3) & 0xF;
  let mantissa = fp8Bits & 0x7;
  const mantissaBits = 3;

  if (exponent === 0xF) {
    // Infinity or NaN
    if (mantissa !== 0) {
      return NaN;
    }
    return sign ? -Infinity : Infinity;
  }

  if (exponent === 0) {
    if (mantissa === 0) {
      // Zero
      return sign ? -0 : 0;
    }
    // Subnormal number: value = (-1)^sign * (mantissa/8) * 2^(-6) = mantissa *
    // 2^(-9) Find the position of the leading 1 bit to normalize
    let shift;
    if (mantissa & 0x4) {
      shift = 1;  // Leading 1 at bit 2 (MSB)
    } else if (mantissa & 0x2) {
      shift = 2;  // Leading 1 at bit 1
    } else {
      shift = 3;  // Leading 1 at bit 0 (LSB)
    }
    // New exponent: original subnormal exp is (1-7) = -6, then subtract shift
    // for normalization
    let newExp = (1 - 7) - shift + 127;
    // Remove the implicit leading 1, keep remaining (mantissaBits - shift) bits
    let remainingBits = mantissaBits - shift;
    let remainingMantissa = mantissa & ((1 << remainingBits) - 1);
    // Shift to Float32 mantissa position (MSB-aligned in 23-bit field)
    let float32MantissaShift = 23 - remainingBits;
    let intView = new Uint32Array(1);
    intView[0] = (sign << 31) | (newExp << 23) |
        (remainingMantissa << float32MantissaShift);
    return new Float32Array(intView.buffer)[0];
  }

  // Normalized number
  let newExp = exponent - 7 + 127;  // Adjust bias back to FP32
  let intView = new Uint32Array(1);
  intView[0] = (sign << 31) | (newExp << 23) | (mantissa << 20);
  let floatView = new Float32Array(intView.buffer);
  return floatView[0];
}

// Calculate loss between original and converted values
function calculateLoss(original, converted, format = 'float32') {
  if (!isFinite(original) || !isFinite(converted)) {
    if (original === converted)
      return '+0.000000000000000';
    if (isNaN(original) || isNaN(converted))
      return 'NaN';
    return 'Infinity';
  }

  const absOriginal = Math.abs(original);
  const absConverted = Math.abs(converted);
  const error = converted - original;  // Keep sign
  const absError = Math.abs(error);

  // Format-specific parameters
  const formatInfo = {
    'float32': {
      mantissaBits: 23,
      expBits: 8,
      expBias: 127,
      minSubnormal: Math.pow(2, -149),
      maxNormal: (2 - Math.pow(2, -23)) * Math.pow(2, 127),
      mantissaMask: 0x7FFFFF,
      expMask: 0xFF,
      expShift: 23
    },
    'tf32': {
      mantissaBits: 10,
      expBits: 8,
      expBias: 127,
      minSubnormal: Math.pow(2, -136),
      maxNormal: (2 - Math.pow(2, -10)) * Math.pow(2, 127),
      mantissaMask: 0x3FF,
      expMask: 0xFF,
      expShift: 10
    },
    'bfloat16': {
      mantissaBits: 7,
      expBits: 8,
      expBias: 127,
      minSubnormal: Math.pow(2, -133),
      maxNormal: (2 - Math.pow(2, -7)) * Math.pow(2, 127),
      mantissaMask: 0x7F,
      expMask: 0xFF,
      expShift: 7
    },
    'float16': {
      mantissaBits: 10,
      expBits: 5,
      expBias: 15,
      minSubnormal: Math.pow(2, -24),
      maxNormal: (2 - Math.pow(2, -10)) * Math.pow(2, 15),
      mantissaMask: 0x3FF,
      expMask: 0x1F,
      expShift: 10
    },
    'fp8e5m2': {
      mantissaBits: 2,
      expBits: 5,
      expBias: 15,
      minSubnormal: Math.pow(2, -16),
      maxNormal: (2 - Math.pow(2, -2)) * Math.pow(2, 15),
      mantissaMask: 0x3,
      expMask: 0x1F,
      expShift: 2
    },
    'fp8e4m3': {
      mantissaBits: 3,
      expBits: 4,
      expBias: 7,
      minSubnormal: Math.pow(2, -9),
      maxNormal: (2 - Math.pow(2, -3)) * Math.pow(2, 7),
      mantissaMask: 0x7,
      expMask: 0xF,
      expShift: 3
    }
  }[format];

  // If converted to zero, show the full original value as error
  if (absConverted === 0) {
    return (original > 0 ? '-' : '+') + original.toExponential(15);
  }

  // If value is larger than format's maximum, show overflow error
  if (absConverted > formatInfo.maxNormal) {
    return 'Overflow: ' + (error > 0 ? '+' : '-') + absError.toExponential(15);
  }

  // Get the native format bits
  let formatBits;
  switch (format) {
    case 'float32':
      formatBits = new Uint32Array(new Float32Array([absConverted]).buffer)[0];
      break;
    case 'tf32':
      formatBits = floatToTF32(absConverted);
      break;
    case 'bfloat16':
      formatBits = floatToBfloat16(absConverted);
      break;
    case 'float16':
      formatBits = floatToFloat16(absConverted);
      break;
    case 'fp8e5m2':
      formatBits = floatToFP8E5M2(absConverted);
      break;
    case 'fp8e4m3':
      formatBits = floatToFP8E4M3(absConverted);
      break;
  }

  // Extract exponent and mantissa using format-specific masks and shifts
  const exponent = (formatBits >>> formatInfo.expShift) & formatInfo.expMask;
  const mantissa = formatBits & formatInfo.mantissaMask;

  let precisionStep;
  if (exponent === 0 && mantissa !== 0) {
    // Subnormal number - precision varies based on actual value
    let leadingZeros = 0;
    let tempMantissa = mantissa;
    const maxMantissaBit = 1 << (formatInfo.mantissaBits - 1);
    while (tempMantissa > 0 && (tempMantissa & maxMantissaBit) === 0) {
      leadingZeros++;
      tempMantissa <<= 1;
    }
    // For subnormals, ULP is fixed at the minimum subnormal value
    precisionStep = formatInfo.minSubnormal;
  } else if (exponent === 0) {
    // Zero - use the smallest possible subnormal value
    precisionStep = formatInfo.minSubnormal;
  } else if (exponent === formatInfo.expMask) {
    // Infinity or NaN
    return (error > 0 ? '+' : '-') + 'Infinity';
  } else {
    // Normal number
    // For normal numbers, find the position of the last significant bit
    let lastSignificantBit = -1;
    for (let i = formatInfo.mantissaBits - 1; i >= 0; i--) {
      if (mantissa & (1 << i)) {
        lastSignificantBit = i;
        break;
      }
    }
    // If we found any significant bits, count from the most significant
    // position If not, we still have the implicit 1, so precision is 1
    precisionStep = lastSignificantBit >= 0 ? lastSignificantBit + 1 : 1;
  }

  // Always show absolute error with sign
  const sign = error > 0 ? '+' : '-';
  // Use regular notation for errors larger than 1e-5
  if (absError >= 1e-7) {
    return `${sign}${absError.toFixed(15)}`;
  }
  return `${sign}${absError.toExponential(15)}`;
}

// Format number to handle very small and very large numbers appropriately
function formatDecimal(num) {
  if (!isFinite(num)) {
    return String(num);
  }

  const absNum = Math.abs(num);

  // For very small numbers (smaller than 1e-7), use scientific notation
  if (absNum > 0 && absNum < 1e-7) {
    return num.toExponential(10);
  }

  // For very large numbers (larger than 1e7), use scientific notation
  if (absNum >= 1e7) {
    return num.toExponential(10);
  }

  // For numbers close to zero
  if (absNum === 0 || absNum < Number.EPSILON) {
    return '0.0000000000';
  }

  // For normal range numbers, use fixed notation
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

// Hide all format cards
function hideAllFormatCards() {
  const formats = [
    'float32', 'tf32', 'bfloat16', 'float16', 'fp8-e5m2', 'fp8-e4m3', 'int8',
    'uint8', 'int16', 'uint16', 'int32', 'uint32'
  ];
  hideElements(formats);
}

// Show floating point format cards
function showFloatFormatCards() {
  const formats =
      ['float32', 'tf32', 'bfloat16', 'float16', 'fp8-e5m2', 'fp8-e4m3'];
  showElements(formats);
}

// Show integer format cards
function showIntegerFormatCards() {
  const formats = ['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32'];
  showElements(formats);
}

// Main conversion function
function convertFloatToHex() {
  let input = document.getElementById('input').value;
  if (!input.trim()) {
    hideAllFormatCards();
    return;
  }

  input = parseFloat(input);
  if (isNaN(input)) {
    alert('Please enter a valid number');
    return;
  }

  // Hide integer elements and show float elements
  hideElements(['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32']);
  showFloatFormatCards();

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

  // Update Float32 fields
  document.getElementById('float32-colored-bits').innerHTML =
      formatBinary(toBinaryString(float32Bits, 32), 8, 23);
  document.getElementById('float32-binary').textContent =
      toBinaryString(float32Bits, 32);
  document.getElementById('float32-hex').textContent =
      '0x' + toHexString(float32Bits, 32);
  document.getElementById('float32-input').textContent = formatDecimal(input);
  document.getElementById('float32-stored').textContent =
      formatDecimal(float32Val);
  document.getElementById('float32-error-row').style.display = '';
  document.getElementById('float32-error').textContent =
      calculateLoss(input, float32Val, 'float32');
  document.getElementById('float32-precision').innerHTML =
      formatPrecisionDetails(float32Val, 'float32');

  // Update TF32 fields
  document.getElementById('tf32-colored-bits').innerHTML =
      formatBinary(toBinaryString(tf32Bits, 19), 8, 10);
  document.getElementById('tf32-binary').textContent =
      toBinaryString(tf32Bits, 19);
  document.getElementById('tf32-hex').textContent =
      '0x' + toHexString(tf32Bits, 19);
  document.getElementById('tf32-input').textContent = formatDecimal(input);
  document.getElementById('tf32-stored').textContent = formatDecimal(tf32Val);
  document.getElementById('tf32-error-row').style.display = '';
  document.getElementById('tf32-error').textContent =
      calculateLoss(input, tf32Val, 'tf32');
  document.getElementById('tf32-precision').innerHTML =
      formatPrecisionDetails(tf32Val, 'tf32');

  // Update Float16 fields
  document.getElementById('float16-colored-bits').innerHTML =
      formatBinary(toBinaryString(float16Bits, 16), 5, 10);
  document.getElementById('float16-binary').textContent =
      toBinaryString(float16Bits, 16);
  document.getElementById('float16-hex').textContent =
      '0x' + toHexString(float16Bits, 16);
  document.getElementById('float16-input').textContent = formatDecimal(input);
  document.getElementById('float16-stored').textContent =
      formatDecimal(float16Val);
  document.getElementById('float16-error-row').style.display = '';
  document.getElementById('float16-error').textContent =
      calculateLoss(input, float16Val, 'float16');
  document.getElementById('float16-precision').innerHTML =
      formatPrecisionDetails(float16Val, 'float16');

  // Update BFloat16 fields
  document.getElementById('bfloat16-colored-bits').innerHTML =
      formatBinary(toBinaryString(bfloat16Bits, 16), 8, 7);
  document.getElementById('bfloat16-binary').textContent =
      toBinaryString(bfloat16Bits, 16);
  document.getElementById('bfloat16-hex').textContent =
      '0x' + toHexString(bfloat16Bits, 16);
  document.getElementById('bfloat16-input').textContent = formatDecimal(input);
  document.getElementById('bfloat16-stored').textContent =
      formatDecimal(bfloat16Val);
  document.getElementById('bfloat16-error-row').style.display = '';
  document.getElementById('bfloat16-error').textContent =
      calculateLoss(input, bfloat16Val, 'bfloat16');
  document.getElementById('bfloat16-precision').innerHTML =
      formatPrecisionDetails(bfloat16Val, 'bfloat16');

  // Update FP8 E5M2 fields
  document.getElementById('fp8-e5m2-colored-bits').innerHTML =
      formatBinary(toBinaryString(fp8E5M2Bits, 8), 5, 2);
  document.getElementById('fp8-e5m2-binary').textContent =
      toBinaryString(fp8E5M2Bits, 8);
  document.getElementById('fp8-e5m2-hex').textContent =
      '0x' + toHexString(fp8E5M2Bits, 8);
  document.getElementById('fp8-e5m2-input').textContent = formatDecimal(input);
  document.getElementById('fp8-e5m2-stored').textContent =
      formatDecimal(fp8E5M2Val);
  document.getElementById('fp8-e5m2-error-row').style.display = '';
  document.getElementById('fp8-e5m2-error').textContent =
      calculateLoss(input, fp8E5M2Val, 'fp8e5m2');
  document.getElementById('fp8-e5m2-precision').innerHTML =
      formatPrecisionDetails(fp8E5M2Val, 'fp8e5m2');

  // Update FP8 E4M3 fields
  document.getElementById('fp8-e4m3-colored-bits').innerHTML =
      formatBinary(toBinaryString(fp8E4M3Bits, 8), 4, 3);
  document.getElementById('fp8-e4m3-binary').textContent =
      toBinaryString(fp8E4M3Bits, 8);
  document.getElementById('fp8-e4m3-hex').textContent =
      '0x' + toHexString(fp8E4M3Bits, 8);
  document.getElementById('fp8-e4m3-input').textContent = formatDecimal(input);
  document.getElementById('fp8-e4m3-stored').textContent =
      formatDecimal(fp8E4M3Val);
  document.getElementById('fp8-e4m3-error-row').style.display = '';
  document.getElementById('fp8-e4m3-error').textContent =
      calculateLoss(input, fp8E4M3Val, 'fp8e4m3');
  document.getElementById('fp8-e4m3-precision').innerHTML =
      formatPrecisionDetails(fp8E4M3Val, 'fp8e4m3');
}

// Format integer binary string with green bit boxes
function formatIntegerBinary(binary) {
  let bits = binary.split('')
                 .map(bit => `<span class='bit-box integer'>${bit}</span>`)
                 .join('');
  return `<div class='bit-container'>${bits}</div>`;
}

// Convert hex to float and integer representations
function convertHexToFloat() {
  let hexInputElement = document.getElementById('hexInput');
  if (!hexInputElement) {
    alert('Hex input element not found');
    return;
  }

  let hexInput = hexInputElement.value.trim();
  if (!hexInput) {
    hideAllFormatCards();
    return;
  }

  hexInput = hexInput.replace(/^0x/i, '').toUpperCase();
  if (!/^[0-9A-F]+$/.test(hexInput)) {
    alert('Please enter a valid hexadecimal number');
    return;
  }

  // Parse hex as a number (bits)
  let bits = parseInt(hexInput, 16);

  // Validate input length for each format
  let isValidFloat32 = hexInput.length <= 8;   // Up to 8 hex digits
  let isValidFloat16 = hexInput.length <= 4;   // Up to 4 hex digits
  let isValidBfloat16 = hexInput.length <= 4;  // Up to 4 hex digits
  let isValidTF32 = hexInput.length <= 5;      // Up to 5 hex digits
  let isValidInt16 = hexInput.length <= 4;     // Up to 4 hex digits
  let isValidUint16 = hexInput.length <= 4;    // Up to 4 hex digits
  let isValidInt8 = hexInput.length <= 2;      // Up to 2 hex digits
  let isValidUint8 = hexInput.length <= 2;     // Up to 2 hex digits
  let isValidInt32 = hexInput.length <= 8;     // Up to 8 hex digits
  let isValidUint32 = hexInput.length <= 8;    // Up to 8 hex digits
  let isValidFp8E5M2 = hexInput.length <= 2;   // Up to 2 hex digits
  let isValidFp8E4M3 = hexInput.length <= 2;   // Up to 2 hex digits

  // Show/hide format cards based on validity
  if (isValidFloat32)
    showElements(['float32']);
  else
    hideElements(['float32']);
  if (isValidFloat16)
    showElements(['float16']);
  else
    hideElements(['float16']);
  if (isValidBfloat16)
    showElements(['bfloat16']);
  else
    hideElements(['bfloat16']);
  if (isValidTF32)
    showElements(['tf32']);
  else
    hideElements(['tf32']);
  if (isValidFp8E5M2)
    showElements(['fp8-e5m2']);
  else
    hideElements(['fp8-e5m2']);
  if (isValidFp8E4M3)
    showElements(['fp8-e4m3']);
  else
    hideElements(['fp8-e4m3']);
  if (isValidInt8)
    showElements(['int8']);
  else
    hideElements(['int8']);
  if (isValidUint8)
    showElements(['uint8']);
  else
    hideElements(['uint8']);
  if (isValidInt16)
    showElements(['int16']);
  else
    hideElements(['int16']);
  if (isValidUint16)
    showElements(['uint16']);
  else
    hideElements(['uint16']);
  if (isValidInt32)
    showElements(['int32']);
  else
    hideElements(['int32']);
  if (isValidUint32)
    showElements(['uint32']);
  else
    hideElements(['uint32']);

  // Float32 (32 bits, 8 hex digits)
  let float32Val = 'Invalid';
  let float32Binary = '';
  if (isValidFloat32) {
    let float32Bits = bits & 0xFFFFFFFF;
    let floatView = new Float32Array(new Uint32Array([float32Bits]).buffer);
    float32Val = formatDecimal(floatView[0]);
    float32Binary = toBinaryString(float32Bits, 32);
  }

  // Float16 (16 bits, 4 hex digits)
  let float16Val = 'Invalid';
  let float16Binary = '';
  if (isValidFloat16) {
    let float16Bits = bits & 0xFFFF;
    float16Val = formatDecimal(float16ToFloat32(float16Bits));
    float16Binary = toBinaryString(float16Bits, 16);
  }

  // Bfloat16 (16 bits, 4 hex digits)
  let bfloat16Val = 'Invalid';
  let bfloat16Binary = '';
  if (isValidBfloat16) {
    let bfloat16Bits = bits & 0xFFFF;
    bfloat16Val = formatDecimal(bfloat16ToFloat32(bfloat16Bits));
    bfloat16Binary = toBinaryString(bfloat16Bits, 16);
  }

  // TF32 (19 bits, 5 hex digits)
  let tf32Val = 'Invalid';
  let tf32Binary = '';
  if (isValidTF32) {
    let tf32Bits = bits & 0x7FFFF;  // Mask to 19 bits
    tf32Val = formatDecimal(tf32ToFloat32(tf32Bits));
    tf32Binary = toBinaryString(tf32Bits, 19);
  }

  // Int16 (16 bits, 4 hex digits)
  let int16Val = 'Invalid';
  let int16Binary = '';
  if (isValidInt16) {
    let int16Bits = (bits << 16) >> 16;  // Sign-extend to 16 bits
    int16Val = int16Bits.toString();
    int16Binary = toBinaryString(int16Bits >>> 0, 16);  // Unsigned for display
  }

  // Uint16 (16 bits, 4 hex digits)
  let uint16Val = 'Invalid';
  let uint16Binary = '';
  if (isValidUint16) {
    let uint16Bits = bits & 0xFFFF;  // Mask to 16 bits (unsigned)
    uint16Val = uint16Bits.toString();
    uint16Binary = toBinaryString(uint16Bits, 16);
  }

  // Int8 (8 bits, 2 hex digits)
  let int8Val = 'Invalid';
  let int8Binary = '';
  if (isValidInt8) {
    let int8Bits = (bits << 24) >> 24;  // Sign-extend to 8 bits
    int8Val = int8Bits.toString();
    int8Binary = toBinaryString(int8Bits >>> 0, 8);  // Unsigned for display
  }

  // Uint8 (8 bits, 2 hex digits)
  let uint8Val = 'Invalid';
  let uint8Binary = '';
  if (isValidUint8) {
    let uint8Bits = bits & 0xFF;  // Mask to 8 bits (unsigned)
    uint8Val = uint8Bits.toString();
    uint8Binary = toBinaryString(uint8Bits, 8);
  }

  // Int32 (32 bits, 8 hex digits)
  let int32Val = 'Invalid';
  let int32Binary = '';
  if (isValidInt32) {
    let int32Bits = bits | 0;  // Convert to signed 32-bit integer
    int32Val = int32Bits.toString();
    int32Binary = toBinaryString(int32Bits >>> 0, 32);  // Unsigned for display
  }

  // Uint32 (32 bits, 8 hex digits)
  let uint32Val = 'Invalid';
  let uint32Binary = '';
  if (isValidUint32) {
    let uint32Bits = bits >>> 0;  // Convert to unsigned 32-bit integer
    uint32Val = uint32Bits.toString();
    uint32Binary = toBinaryString(uint32Bits, 32);
  }

  // FP8 E5M2 (8 bits, 2 hex digits)
  let fp8E5M2Val = 'Invalid';
  let fp8E5M2Binary = '';
  if (isValidFp8E5M2) {
    let fp8E5M2Bits = bits & 0xFF;  // Mask to 8 bits
    fp8E5M2Val = formatDecimal(fp8E5M2ToFloat(fp8E5M2Bits));
    fp8E5M2Binary = toBinaryString(fp8E5M2Bits, 8);
  }

  // FP8 E4M3 (8 bits, 2 hex digits)
  let fp8E4M3Val = 'Invalid';
  let fp8E4M3Binary = '';
  if (isValidFp8E4M3) {
    let fp8E4M3Bits = bits & 0xFF;  // Mask to 8 bits
    fp8E4M3Val = formatDecimal(fp8E4M3ToFloat(fp8E4M3Bits));
    fp8E4M3Binary = toBinaryString(fp8E4M3Bits, 8);
  }

  // Update Int8 fields
  if (isValidInt8) {
    document.getElementById('int8-colored-bits').innerHTML =
        formatIntegerBinary(int8Binary);
    document.getElementById('int8-binary').textContent = int8Binary;
    document.getElementById('int8-hex').textContent = '0x' + hexInput;
    document.getElementById('int8-value').textContent = int8Val;
  }

  // Update Uint8 fields
  if (isValidUint8) {
    document.getElementById('uint8-colored-bits').innerHTML =
        formatIntegerBinary(uint8Binary);
    document.getElementById('uint8-binary').textContent = uint8Binary;
    document.getElementById('uint8-hex').textContent = '0x' + hexInput;
    document.getElementById('uint8-value').textContent = uint8Val;
  }

  // Update Int16 fields
  if (isValidInt16) {
    document.getElementById('int16-colored-bits').innerHTML =
        formatIntegerBinary(int16Binary);
    document.getElementById('int16-binary').textContent = int16Binary;
    document.getElementById('int16-hex').textContent = '0x' + hexInput;
    document.getElementById('int16-value').textContent = int16Val;
  }

  // Update Uint16 fields
  if (isValidUint16) {
    document.getElementById('uint16-colored-bits').innerHTML =
        formatIntegerBinary(uint16Binary);
    document.getElementById('uint16-binary').textContent = uint16Binary;
    document.getElementById('uint16-hex').textContent = '0x' + hexInput;
    document.getElementById('uint16-value').textContent = uint16Val;
  }

  // Update Int32 fields
  if (isValidInt32) {
    document.getElementById('int32-colored-bits').innerHTML =
        formatIntegerBinary(int32Binary);
    document.getElementById('int32-binary').textContent = int32Binary;
    document.getElementById('int32-hex').textContent = '0x' + hexInput;
    document.getElementById('int32-value').textContent = int32Val;
  }

  // Update Uint32 fields
  if (isValidUint32) {
    document.getElementById('uint32-colored-bits').innerHTML =
        formatIntegerBinary(uint32Binary);
    document.getElementById('uint32-binary').textContent = uint32Binary;
    document.getElementById('uint32-hex').textContent = '0x' + hexInput;
    document.getElementById('uint32-value').textContent = uint32Val;
  }

  // Update floating point fields
  if (isValidFloat32) {
    document.getElementById('float32-colored-bits').innerHTML =
        formatBinary(float32Binary, 8, 23);
    document.getElementById('float32-binary').textContent = float32Binary;
    document.getElementById('float32-hex').textContent =
        '0x' + hexInput.padStart(8, '0');
    document.getElementById('float32-input').textContent = '(from hex)';
    document.getElementById('float32-stored').textContent = float32Val;
    document.getElementById('float32-error-row').style.display = 'none';
    document.getElementById('float32-precision').innerHTML = '';
  }

  if (isValidFloat16) {
    document.getElementById('float16-colored-bits').innerHTML =
        formatBinary(float16Binary, 5, 10);
    document.getElementById('float16-binary').textContent = float16Binary;
    document.getElementById('float16-hex').textContent =
        '0x' + hexInput.padStart(4, '0');
    document.getElementById('float16-input').textContent = '(from hex)';
    document.getElementById('float16-stored').textContent = float16Val;
    document.getElementById('float16-error-row').style.display = 'none';
    document.getElementById('float16-precision').innerHTML = '';
  }

  if (isValidBfloat16) {
    document.getElementById('bfloat16-colored-bits').innerHTML =
        formatBinary(bfloat16Binary, 8, 7);
    document.getElementById('bfloat16-binary').textContent = bfloat16Binary;
    document.getElementById('bfloat16-hex').textContent =
        '0x' + hexInput.padStart(4, '0');
    document.getElementById('bfloat16-input').textContent = '(from hex)';
    document.getElementById('bfloat16-stored').textContent = bfloat16Val;
    document.getElementById('bfloat16-error-row').style.display = 'none';
    document.getElementById('bfloat16-precision').innerHTML = '';
  }

  if (isValidTF32) {
    document.getElementById('tf32-colored-bits').innerHTML =
        formatBinary(tf32Binary, 8, 10);
    document.getElementById('tf32-binary').textContent = tf32Binary;
    document.getElementById('tf32-hex').textContent =
        '0x' + hexInput.padStart(5, '0');
    document.getElementById('tf32-input').textContent = '(from hex)';
    document.getElementById('tf32-stored').textContent = tf32Val;
    document.getElementById('tf32-error-row').style.display = 'none';
    document.getElementById('tf32-precision').innerHTML = '';
  }

  // Update FP8 fields
  if (isValidFp8E5M2) {
    let fp8E5M2Bits = bits & 0xFF;
    let fp8E5M2Val = formatDecimal(fp8E5M2ToFloat(fp8E5M2Bits));
    let fp8E5M2Binary = toBinaryString(fp8E5M2Bits, 8);
    document.getElementById('fp8-e5m2-colored-bits').innerHTML =
        formatBinary(fp8E5M2Binary, 5, 2);
    document.getElementById('fp8-e5m2-binary').textContent = fp8E5M2Binary;
    document.getElementById('fp8-e5m2-hex').textContent =
        '0x' + hexInput.padStart(2, '0');
    document.getElementById('fp8-e5m2-input').textContent = '(from hex)';
    document.getElementById('fp8-e5m2-stored').textContent = fp8E5M2Val;
    document.getElementById('fp8-e5m2-error-row').style.display = 'none';
    document.getElementById('fp8-e5m2-precision').innerHTML = '';
  }

  if (isValidFp8E4M3) {
    let fp8E4M3Bits = bits & 0xFF;
    let fp8E4M3Val = formatDecimal(fp8E4M3ToFloat(fp8E4M3Bits));
    let fp8E4M3Binary = toBinaryString(fp8E4M3Bits, 8);
    document.getElementById('fp8-e4m3-colored-bits').innerHTML =
        formatBinary(fp8E4M3Binary, 4, 3);
    document.getElementById('fp8-e4m3-binary').textContent = fp8E4M3Binary;
    document.getElementById('fp8-e4m3-hex').textContent =
        '0x' + hexInput.padStart(2, '0');
    document.getElementById('fp8-e4m3-input').textContent = '(from hex)';
    document.getElementById('fp8-e4m3-stored').textContent = fp8E4M3Val;
    document.getElementById('fp8-e4m3-error-row').style.display = 'none';
    document.getElementById('fp8-e4m3-precision').innerHTML = '';
  }
}

// Analyze precision details for a floating point number
function analyzePrecision(value, format = 'float32') {
  // Format-specific parameters
  const formatInfo = {
    'float32': {
      mantissaBits: 23,
      expBits: 8,
      expBias: 127,
      minSubnormal: Math.pow(2, -149),
      maxNormal: (2 - Math.pow(2, -23)) * Math.pow(2, 127),
      minNormal: Math.pow(2, -126),
      expMask: 0xFF,
      mantissaMask: 0x7FFFFF,
      expShift: 23
    },
    'tf32': {
      mantissaBits: 10,
      expBits: 8,
      expBias: 127,
      minSubnormal: Math.pow(2, -136),
      maxNormal: (2 - Math.pow(2, -10)) * Math.pow(2, 127),
      minNormal: Math.pow(2, -126),
      expMask: 0xFF,
      mantissaMask: 0x3FF,
      expShift: 10
    },
    'bfloat16': {
      mantissaBits: 7,
      expBits: 8,
      expBias: 127,
      minSubnormal: Math.pow(2, -133),
      maxNormal: (2 - Math.pow(2, -7)) * Math.pow(2, 127),
      minNormal: Math.pow(2, -126),
      expMask: 0xFF,
      mantissaMask: 0x7F,
      expShift: 7
    },
    'float16': {
      mantissaBits: 10,
      expBits: 5,
      expBias: 15,
      minSubnormal: Math.pow(2, -24),
      maxNormal: (2 - Math.pow(2, -10)) * Math.pow(2, 15),
      minNormal: Math.pow(2, -14),
      expMask: 0x1F,
      mantissaMask: 0x3FF,
      expShift: 10
    },
    'fp8e5m2': {
      mantissaBits: 2,
      expBits: 5,
      expBias: 15,
      minSubnormal: Math.pow(2, -16),
      maxNormal: (2 - Math.pow(2, -2)) * Math.pow(2, 15),
      minNormal: Math.pow(2, -14),
      expMask: 0x1F,
      mantissaMask: 0x3,
      expShift: 2
    },
    'fp8e4m3': {
      mantissaBits: 3,
      expBits: 4,
      expBias: 7,
      minSubnormal: Math.pow(2, -9),
      maxNormal: (2 - Math.pow(2, -3)) * Math.pow(2, 7),
      minNormal: Math.pow(2, -6),
      expMask: 0xF,
      mantissaMask: 0x7,
      expShift: 3
    }
  }[format];

  // Get the native format bits
  let formatBits;
  switch (format) {
    case 'float32':
      formatBits =
          new Uint32Array(new Float32Array([Math.abs(value)]).buffer)[0];
      break;
    case 'tf32':
      formatBits = floatToTF32(Math.abs(value));
      break;
    case 'bfloat16':
      formatBits = floatToBfloat16(Math.abs(value));
      break;
    case 'float16':
      formatBits = floatToFloat16(Math.abs(value));
      break;
    case 'fp8e5m2':
      formatBits = floatToFP8E5M2(Math.abs(value));
      break;
    case 'fp8e4m3':
      formatBits = floatToFP8E4M3(Math.abs(value));
      break;
  }

  const sign = value < 0 ? 1 : 0;
  const exponent = (formatBits >>> formatInfo.expShift) & formatInfo.expMask;
  const mantissa = formatBits & formatInfo.mantissaMask;

  // Check if the value is exactly zero
  if (value === 0) {
    return {
      sign: sign,
      exponent: 0,
      mantissa: 0,
      effectiveBits: 0,
      isSubnormal: false,
      isUnderflow: true,
      minRepresentable: formatInfo.minSubnormal
    };
  }

  // Check for special cases
  if (exponent === formatInfo.expMask) {
    return {
      sign: sign,
      exponent: Infinity,
      mantissa: mantissa,
      effectiveBits: mantissa === 0 ? 0 : formatInfo.mantissaBits,
      isSubnormal: false,
      isUnderflow: false,
      minRepresentable: 0
    };
  }

  // Calculate effective bits: minimum mantissa bits needed to represent this
  // value exactly This is determined by counting trailing zeros in the mantissa
  let effectiveBits;
  let precisionStep;

  if (mantissa === 0) {
    // Value is an exact power of 2 (or zero), no mantissa bits needed
    effectiveBits = 0;
  } else {
    // Count trailing zeros to find lowest set bit
    let trailingZeros = 0;
    let temp = mantissa;
    while ((temp & 1) === 0) {
      temp >>>= 1;
      trailingZeros++;
    }
    // Bits needed = total mantissa bits - trailing zeros
    effectiveBits = formatInfo.mantissaBits - trailingZeros;
  }

  // Determine if it's a subnormal number
  const isSubnormal = exponent === 0 && mantissa !== 0;

  // Calculate the actual exponent (removing bias)
  const actualExponent =
      isSubnormal ? 1 - formatInfo.expBias : (exponent - formatInfo.expBias);

  // Calculate the precision step (ULP - Unit in the Last Place)
  if (isSubnormal) {
    precisionStep = formatInfo.minSubnormal;
  } else {
    // For normal numbers, ULP is 2^(exponent - mantissa_bits)
    precisionStep = Math.pow(2, actualExponent - formatInfo.mantissaBits);
  }

  return {
    sign: sign,
    exponent: actualExponent,
    mantissa: mantissa,
    effectiveBits: effectiveBits,
    isSubnormal: isSubnormal,
    isUnderflow: Math.abs(value) < formatInfo.minSubnormal,
    minRepresentable: precisionStep
  };
}

// Determine which formats can exactly represent a value
function getCompatibleFormats(value, bitsRequired, actualExponent) {
  // Format specifications: mantissa bits, min exponent (normal), max exponent
  const formats = {
    'Float32': {
      mantissa: 23,
      minExp: -126,
      maxExp: 127,
      minSubnormal: Math.pow(2, -149)
    },
    'TF32': {
      mantissa: 10,
      minExp: -126,
      maxExp: 127,
      minSubnormal: Math.pow(2, -136)
    },
    'BFloat16': {
      mantissa: 7,
      minExp: -126,
      maxExp: 127,
      minSubnormal: Math.pow(2, -133)
    },
    'Float16':
        {mantissa: 10, minExp: -14, maxExp: 15, minSubnormal: Math.pow(2, -24)},
    'FP8 E5M2':
        {mantissa: 2, minExp: -14, maxExp: 15, minSubnormal: Math.pow(2, -16)},
    'FP8 E4M3':
        {mantissa: 3, minExp: -6, maxExp: 7, minSubnormal: Math.pow(2, -9)}
  };

  const absValue = Math.abs(value);
  const compatible = [];

  // Handle special cases
  if (!isFinite(value)) {
    // Infinity and NaN can be represented in all formats
    return Object.keys(formats);
  }

  if (value === 0) {
    // Zero can be represented in all formats
    return Object.keys(formats);
  }

  for (const [name, spec] of Object.entries(formats)) {
    // Check mantissa bits
    if (bitsRequired > spec.mantissa) {
      continue;
    }

    // Check exponent range
    if (actualExponent >= spec.minExp && actualExponent <= spec.maxExp) {
      // Normal number fits
      compatible.push(name);
    } else if (absValue >= spec.minSubnormal && actualExponent < spec.minExp) {
      // Could be subnormal in this format - check if mantissa precision is
      // sufficient For subnormals, we lose precision as value gets smaller
      const subnormalShift = spec.minExp - actualExponent;
      const effectiveMantissaBits = spec.mantissa - subnormalShift;
      if (effectiveMantissaBits >= bitsRequired) {
        compatible.push(name + ' (subnormal)');
      }
    }
  }

  return compatible;
}

// Format the precision analysis results
function formatPrecisionDetails(value, format = 'float32') {
  const analysis = analyzePrecision(value, format);
  const formatInfo = {
    'float32': {
      mantissaBits: 23,
      expBits: 8,
      expBias: 127,
      description: 'IEEE 754 Single Precision'
    },
    'tf32': {
      mantissaBits: 10,
      expBits: 8,
      expBias: 127,
      description: 'NVIDIA Tensor Float'
    },
    'bfloat16': {
      mantissaBits: 7,
      expBits: 8,
      expBias: 127,
      description: 'Brain Floating Point'
    },
    'float16': {
      mantissaBits: 10,
      expBits: 5,
      expBias: 15,
      description: 'IEEE 754 Half Precision'
    },
    'fp8e5m2': {
      mantissaBits: 2,
      expBits: 5,
      expBias: 15,
      description: 'NVIDIA 8-bit E5M2'
    },
    'fp8e4m3': {
      mantissaBits: 3,
      expBits: 4,
      expBias: 7,
      description: 'NVIDIA 8-bit E4M3'
    }
  }[format];

  let representationStatus;
  let representationTitle;

  if (analysis.isUnderflow) {
    representationStatus = '<strong>Underflow to Zero</strong>';
    representationTitle =
        `This number is too small to represent in ${formatInfo.description}`;
  } else if (analysis.isSubnormal) {
    representationStatus = '<strong>Subnormal</strong>';
    representationTitle =
        `Using gradual underflow for increased precision near zero`;
  } else if (analysis.exponent === Infinity) {
    if (analysis.mantissa === 0) {
      representationStatus = '<strong>Infinity</strong>';
      representationTitle = 'Number too large to represent';
    } else {
      representationStatus = '<strong>NaN</strong>';
      representationTitle = 'Not a Number';
    }
  } else {
    representationStatus = '<strong>Normal</strong>';
    representationTitle =
        'Using normalized representation with implicit leading 1';
  }

  // Get compatible formats for lossless conversion
  const compatibleFormats =
      getCompatibleFormats(value, analysis.effectiveBits, analysis.exponent);
  const compatibleList = compatibleFormats.length > 0 ?
      compatibleFormats.join(', ') :
      'None (value requires higher precision or wider range)';

  return `
        <strong class="precision-title">Precision Analysis</strong>
        <div class="precision-details">
            <div class="precision-item" title="Minimum mantissa bits required to represent this exact value (fewer bits = can fit in lower precision formats)">
                <strong>Bits Required:</strong> ${analysis.effectiveBits}/${
      formatInfo.mantissaBits} bits
            </div>
            <div class="precision-item" title="The power of 2 in the binary scientific notation">
                <strong>Binary Exponent:</strong> ${analysis.exponent} (bias: ${
      formatInfo.expBias})
            </div>
            <div class="precision-item" title="${representationTitle}">
                <strong>Representation:</strong> ${representationStatus}
            </div>
            <div class="precision-item" title="The smallest possible change in value at this magnitude (ULP)">
                <strong>Precision Step:</strong> ${
      analysis.minRepresentable.toExponential(5)}
            </div>
            <div class="precision-item" title="Formats that can represent this exact value without loss">
                <strong>Lossless Formats:</strong> ${compatibleList}
            </div>
        </div>
        <div class="bit-info" title="Distribution of bits in ${
      formatInfo.description}">
            <span><strong>Sign:</strong> 1 bit</span>
            <span><strong>Exponent:</strong> ${formatInfo.expBits} bits</span>
            <span><strong>Mantissa:</strong> ${
      formatInfo.mantissaBits} bits</span>
        </div>
    `;
}

// Call hideAllFormatCards when the page loads
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', hideAllFormatCards);
}

// Export functions for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    toBinaryString,
    toHexString,
    formatBinary,
    floatToBfloat16,
    bfloat16ToFloat32,
    floatToTF32,
    tf32ToFloat32,
    floatToFloat16,
    float16ToFloat32,
    floatToFP8E5M2,
    fp8E5M2ToFloat,
    floatToFP8E4M3,
    fp8E4M3ToFloat,
    calculateLoss,
    formatDecimal,
    analyzePrecision,
    formatPrecisionDetails,
    analyzePrecision,
    getCompatibleFormats
  };
}
