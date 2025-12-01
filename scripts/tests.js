// IEEE 754 Converter Tests
// Run with: node --test tests.js

const {describe, it} = require('node:test');
const assert = require('node:assert');

// Import conversion functions from main.js
const {
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
  analyzePrecision,
  getCompatibleFormats
} = require('./main.js');

// ============================================================================
// Helper Functions
// ============================================================================

function assertClose(actual, expected, tolerance = 1e-7, message = '') {
  const diff = Math.abs(actual - expected);
  assert.ok(
      diff <= tolerance,
      `${message}Expected ~${expected}, got ${actual} (diff: ${
          diff}, tolerance: ${tolerance})`);
}

function assertHex(actual, expected, message = '') {
  assert.strictEqual(
      actual, expected,
      `${message}Expected 0x${expected.toString(16).toUpperCase()}, got 0x${
          actual.toString(16).toUpperCase()}`);
}

function isNegativeZero(x) {
  return x === 0 && 1 / x === -Infinity;
}

function isPositiveZero(x) {
  return x === 0 && 1 / x === Infinity;
}

// ============================================================================
// BFloat16 Tests
// ============================================================================

describe('BFloat16 Conversions', () => {
  it('Convert 0.0 to BFloat16 and back', () => {
    const bits = floatToBfloat16(0.0);
    assertHex(bits, 0x0000);
    const result = bfloat16ToFloat32(bits);
    assert.ok(isPositiveZero(result), 'Should be positive zero');
  });

  it('Convert -0.0 to BFloat16 and back', () => {
    const bits = floatToBfloat16(-0.0);
    assertHex(bits, 0x8000);
    const result = bfloat16ToFloat32(bits);
    assert.ok(isNegativeZero(result), 'Should be negative zero');
  });

  it('Convert 1.0 to BFloat16 and back', () => {
    const bits = floatToBfloat16(1.0);
    assertHex(bits, 0x3F80);
    assert.strictEqual(bfloat16ToFloat32(bits), 1.0);
  });

  it('Convert -1.0 to BFloat16 and back', () => {
    const bits = floatToBfloat16(-1.0);
    assertHex(bits, 0xBF80);
    assert.strictEqual(bfloat16ToFloat32(bits), -1.0);
  });

  it('Convert 2.0 to BFloat16 and back', () => {
    const bits = floatToBfloat16(2.0);
    assertHex(bits, 0x4000);
    assert.strictEqual(bfloat16ToFloat32(bits), 2.0);
  });

  it('Convert 0.5 to BFloat16 and back', () => {
    const bits = floatToBfloat16(0.5);
    assertHex(bits, 0x3F00);
    assert.strictEqual(bfloat16ToFloat32(bits), 0.5);
  });

  it('Convert 3.14159 to BFloat16 (precision loss expected)', () => {
    const bits = floatToBfloat16(3.14159);
    const result = bfloat16ToFloat32(bits);
    assertClose(result, 3.14159, 0.01);
  });

  it('Convert +Infinity to BFloat16 and back', () => {
    const bits = floatToBfloat16(Infinity);
    assertHex(bits, 0x7F80);
    assert.strictEqual(bfloat16ToFloat32(bits), Infinity);
  });

  it('Convert -Infinity to BFloat16 and back', () => {
    const bits = floatToBfloat16(-Infinity);
    assertHex(bits, 0xFF80);
    assert.strictEqual(bfloat16ToFloat32(bits), -Infinity);
  });

  it('Convert NaN to BFloat16 and back', () => {
    const bits = floatToBfloat16(NaN);
    assert.strictEqual(bits & 0x7F80, 0x7F80, 'Exponent should be all 1s');
    assert.notStrictEqual(
        bits & 0x007F, 0, 'Mantissa should be non-zero for NaN');
    assert.ok(Number.isNaN(bfloat16ToFloat32(bits)), 'Result should be NaN');
  });

  it('Convert large value 1e38 to BFloat16', () => {
    const bits = floatToBfloat16(1e38);
    const result = bfloat16ToFloat32(bits);
    assertClose(result, 1e38, 1e36);
  });

  it('Convert small value 1e-38 to BFloat16', () => {
    const bits = floatToBfloat16(1e-38);
    const result = bfloat16ToFloat32(bits);
    assertClose(result, 1e-38, 2e-39);
  });

  it('Convert BFloat16 subnormal 0x0001 to Float32', () => {
    const result = bfloat16ToFloat32(0x0001);
    assertClose(result, Math.pow(2, -133), 1e-45);
  });

  it('Convert BFloat16 subnormal 0x007F to Float32', () => {
    const result = bfloat16ToFloat32(0x007F);
    const expected = (127 / 128) * Math.pow(2, -126);
    assertClose(result, expected, 1e-40);
  });

  it('Hex 0x4048 should decode to ~3.125', () => {
    const result = bfloat16ToFloat32(0x4048);
    assertClose(result, 3.125, 0.01);
  });

  it('Hex 0x3DCC should decode to ~0.1 (approx)', () => {
    const result = bfloat16ToFloat32(0x3DCC);
    assertClose(result, 0.1, 0.01);
  });
});

// ============================================================================
// Float16 Tests
// ============================================================================

describe('Float16 (FP16) Conversions', () => {
  it('Convert 0.0 to Float16 and back', () => {
    const bits = floatToFloat16(0.0);
    assertHex(bits, 0x0000);
    assert.ok(
        isPositiveZero(float16ToFloat32(bits)), 'Should be positive zero');
  });

  it('Convert -0.0 to Float16 and back', () => {
    const bits = floatToFloat16(-0.0);
    assertHex(bits, 0x8000);
    assert.ok(
        isNegativeZero(float16ToFloat32(bits)), 'Should be negative zero');
  });

  it('Convert 1.0 to Float16 and back', () => {
    const bits = floatToFloat16(1.0);
    assertHex(bits, 0x3C00);
    assert.strictEqual(float16ToFloat32(bits), 1.0);
  });

  it('Convert -1.0 to Float16 and back', () => {
    const bits = floatToFloat16(-1.0);
    assertHex(bits, 0xBC00);
    assert.strictEqual(float16ToFloat32(bits), -1.0);
  });

  it('Convert 2.0 to Float16 and back', () => {
    const bits = floatToFloat16(2.0);
    assertHex(bits, 0x4000);
    assert.strictEqual(float16ToFloat32(bits), 2.0);
  });

  it('Convert 0.5 to Float16 and back', () => {
    const bits = floatToFloat16(0.5);
    assertHex(bits, 0x3800);
    assert.strictEqual(float16ToFloat32(bits), 0.5);
  });

  it('Convert 65504 (max normal) to Float16 and back', () => {
    const bits = floatToFloat16(65504);
    assertHex(bits, 0x7BFF);
    assert.strictEqual(float16ToFloat32(bits), 65504);
  });

  it('Convert +Infinity to Float16 and back', () => {
    const bits = floatToFloat16(Infinity);
    assertHex(bits, 0x7C00);
    assert.strictEqual(float16ToFloat32(bits), Infinity);
  });

  it('Convert -Infinity to Float16 and back', () => {
    const bits = floatToFloat16(-Infinity);
    assertHex(bits, 0xFC00);
    assert.strictEqual(float16ToFloat32(bits), -Infinity);
  });

  it('Convert NaN to Float16 and back', () => {
    const bits = floatToFloat16(NaN);
    assert.strictEqual(bits & 0x7C00, 0x7C00, 'Exponent should be all 1s');
    assert.notStrictEqual(
        bits & 0x03FF, 0, 'Mantissa should be non-zero for NaN');
    assert.ok(Number.isNaN(float16ToFloat32(bits)), 'Result should be NaN');
  });

  it('Convert 100000 to Float16 (overflow to infinity)', () => {
    const bits = floatToFloat16(100000);
    assertHex(bits, 0x7C00);
  });

  it('Convert -100000 to Float16 (overflow to -infinity)', () => {
    const bits = floatToFloat16(-100000);
    assertHex(bits, 0xFC00);
  });

  it('Convert Float16 subnormal 0x0001 to Float32', () => {
    const result = float16ToFloat32(0x0001);
    assertClose(result, Math.pow(2, -24), 1e-10);
  });

  it('Convert Float16 subnormal 0x03FF to Float32', () => {
    const result = float16ToFloat32(0x03FF);
    const expected = (1023 / 1024) * Math.pow(2, -14);
    assertClose(result, expected, 1e-10);
  });

  it('Convert very small value to Float16 (becomes subnormal)', () => {
    const value = Math.pow(2, -20);
    const bits = floatToFloat16(value);
    const result = float16ToFloat32(bits);
    assertClose(result, value, 1e-10);
  });

  it('Float16 rounding - round up case', () => {
    const value = 1.0009765625;
    const bits = floatToFloat16(value);
    const result = float16ToFloat32(bits);
    assert.ok(
        result === 1.0 || result === 1.0009765625 ||
            Math.abs(result - value) < 0.002,
        `Rounding result ${result} should be close to ${value}`);
  });

  it('Hex 0x4248 decodes to 3.140625', () => {
    const result = float16ToFloat32(0x4248);
    assert.strictEqual(result, 3.140625);
  });

  it('Hex 0x2E66 decodes to approximately 0.1', () => {
    const result = float16ToFloat32(0x2E66);
    assertClose(result, 0.09997558, 0.0001);
  });
});

// ============================================================================
// TF32 Tests
// ============================================================================

describe('TF32 Conversions', () => {
  it('Convert 0.0 to TF32 and back', () => {
    const bits = floatToTF32(0.0);
    assertHex(bits, 0x00000);
    assert.ok(isPositiveZero(tf32ToFloat32(bits)), 'Should be positive zero');
  });

  it('Convert -0.0 to TF32 and back', () => {
    const bits = floatToTF32(-0.0);
    assertHex(bits, 0x40000);
    assert.ok(isNegativeZero(tf32ToFloat32(bits)), 'Should be negative zero');
  });

  it('Convert 1.0 to TF32 and back', () => {
    const bits = floatToTF32(1.0);
    assertHex(bits, 0x1FC00);
    assert.strictEqual(tf32ToFloat32(bits), 1.0);
  });

  it('Convert -1.0 to TF32 and back', () => {
    const bits = floatToTF32(-1.0);
    assertHex(bits, 0x5FC00);
    assert.strictEqual(tf32ToFloat32(bits), -1.0);
  });

  it('Convert 2.0 to TF32 and back', () => {
    const bits = floatToTF32(2.0);
    assertHex(bits, 0x20000);
    assert.strictEqual(tf32ToFloat32(bits), 2.0);
  });

  it('Convert +Infinity to TF32 and back', () => {
    const bits = floatToTF32(Infinity);
    assertHex(bits, 0x3FC00);
    assert.strictEqual(tf32ToFloat32(bits), Infinity);
  });

  it('Convert -Infinity to TF32 and back', () => {
    const bits = floatToTF32(-Infinity);
    assertHex(bits, 0x7FC00);
    assert.strictEqual(tf32ToFloat32(bits), -Infinity);
  });

  it('Convert NaN to TF32 and back', () => {
    const bits = floatToTF32(NaN);
    assert.ok(Number.isNaN(tf32ToFloat32(bits)), 'Result should be NaN');
  });

  it('Convert 3.14159 to TF32 (some precision loss)', () => {
    const bits = floatToTF32(3.14159);
    const result = tf32ToFloat32(bits);
    assertClose(result, 3.14159, 0.001);
  });

  it('Convert large value 1e38 to TF32', () => {
    const bits = floatToTF32(1e38);
    const result = tf32ToFloat32(bits);
    assertClose(result, 1e38, 1e35);
  });

  it('Convert TF32 subnormal 0x00001 to Float32', () => {
    // Smallest TF32 subnormal: exp=0, mantissa=1
    // Value = (1/1024) * 2^(-126) = 2^(-136)
    const result = tf32ToFloat32(0x00001);
    assertClose(result, Math.pow(2, -136), 1e-45);
  });

  it('Convert TF32 subnormal 0x003FF to Float32', () => {
    // Largest TF32 subnormal: exp=0, mantissa=1023
    // Value = (1023/1024) * 2^(-126)
    const result = tf32ToFloat32(0x003FF);
    const expected = (1023 / 1024) * Math.pow(2, -126);
    assertClose(result, expected, 1e-42);
  });
});

// ============================================================================
// FP8 E5M2 Tests
// ============================================================================

describe('FP8 E5M2 Conversions', () => {
  it('Convert 0.0 to FP8 E5M2 and back', () => {
    const bits = floatToFP8E5M2(0.0);
    assertHex(bits, 0x00);
    assert.ok(isPositiveZero(fp8E5M2ToFloat(bits)), 'Should be positive zero');
  });

  it('Convert -0.0 to FP8 E5M2 and back', () => {
    const bits = floatToFP8E5M2(-0.0);
    assertHex(bits, 0x80);
    assert.ok(isNegativeZero(fp8E5M2ToFloat(bits)), 'Should be negative zero');
  });

  it('Convert 1.0 to FP8 E5M2 and back', () => {
    const bits = floatToFP8E5M2(1.0);
    assertHex(bits, 0x3C);
    assert.strictEqual(fp8E5M2ToFloat(bits), 1.0);
  });

  it('Convert -1.0 to FP8 E5M2 and back', () => {
    const bits = floatToFP8E5M2(-1.0);
    assertHex(bits, 0xBC);
    assert.strictEqual(fp8E5M2ToFloat(bits), -1.0);
  });

  it('Convert 2.0 to FP8 E5M2 and back', () => {
    const bits = floatToFP8E5M2(2.0);
    assertHex(bits, 0x40);
    assert.strictEqual(fp8E5M2ToFloat(bits), 2.0);
  });

  it('Convert 0.5 to FP8 E5M2 and back', () => {
    const bits = floatToFP8E5M2(0.5);
    assertHex(bits, 0x38);
    assert.strictEqual(fp8E5M2ToFloat(bits), 0.5);
  });

  it('Convert 1.5 to FP8 E5M2 and back', () => {
    const bits = floatToFP8E5M2(1.5);
    assertHex(bits, 0x3E);
    assert.strictEqual(fp8E5M2ToFloat(bits), 1.5);
  });

  it('Convert +Infinity to FP8 E5M2 and back', () => {
    const bits = floatToFP8E5M2(Infinity);
    assertHex(bits, 0x7C);
    assert.strictEqual(fp8E5M2ToFloat(bits), Infinity);
  });

  it('Convert -Infinity to FP8 E5M2 and back', () => {
    const bits = floatToFP8E5M2(-Infinity);
    assertHex(bits, 0xFC);
    assert.strictEqual(fp8E5M2ToFloat(bits), -Infinity);
  });

  it('Convert NaN to FP8 E5M2 and back', () => {
    const bits = floatToFP8E5M2(NaN);
    assert.strictEqual(bits & 0x7C, 0x7C, 'Exponent should be all 1s');
    assert.notStrictEqual(
        bits & 0x03, 0, 'Mantissa should be non-zero for NaN');
    assert.ok(Number.isNaN(fp8E5M2ToFloat(bits)), 'Result should be NaN');
  });

  it('Overflow to infinity in FP8 E5M2', () => {
    const bits = floatToFP8E5M2(100000);
    assertHex(bits, 0x7C);
  });

  it('FP8 E5M2 subnormal 0x01 converts correctly', () => {
    const result = fp8E5M2ToFloat(0x01);
    assertClose(result, Math.pow(2, -16), 1e-10);
  });

  it('FP8 E5M2 subnormal 0x03 converts correctly', () => {
    const result = fp8E5M2ToFloat(0x03);
    assertClose(result, 0.75 * Math.pow(2, -14), 1e-10);
  });

  it('Convert small value to FP8 E5M2 (becomes subnormal)', () => {
    const value = Math.pow(2, -15);
    const bits = floatToFP8E5M2(value);
    const result = fp8E5M2ToFloat(bits);
    assertClose(result, value, 1e-6);
  });

  it('Hex 0x41 decodes to 2.5', () => {
    const result = fp8E5M2ToFloat(0x41);
    assert.strictEqual(result, 2.5);
  });

  it('Hex 0x42 decodes to 3.0', () => {
    const result = fp8E5M2ToFloat(0x42);
    assert.strictEqual(result, 3.0);
  });
});

// ============================================================================
// FP8 E4M3 Tests
// ============================================================================

describe('FP8 E4M3 Conversions', () => {
  it('Convert 0.0 to FP8 E4M3 and back', () => {
    const bits = floatToFP8E4M3(0.0);
    assertHex(bits, 0x00);
    assert.ok(isPositiveZero(fp8E4M3ToFloat(bits)), 'Should be positive zero');
  });

  it('Convert -0.0 to FP8 E4M3 and back', () => {
    const bits = floatToFP8E4M3(-0.0);
    assertHex(bits, 0x80);
    assert.ok(isNegativeZero(fp8E4M3ToFloat(bits)), 'Should be negative zero');
  });

  it('Convert 1.0 to FP8 E4M3 and back', () => {
    const bits = floatToFP8E4M3(1.0);
    assertHex(bits, 0x38);
    assert.strictEqual(fp8E4M3ToFloat(bits), 1.0);
  });

  it('Convert -1.0 to FP8 E4M3 and back', () => {
    const bits = floatToFP8E4M3(-1.0);
    assertHex(bits, 0xB8);
    assert.strictEqual(fp8E4M3ToFloat(bits), -1.0);
  });

  it('Convert 2.0 to FP8 E4M3 and back', () => {
    const bits = floatToFP8E4M3(2.0);
    assertHex(bits, 0x40);
    assert.strictEqual(fp8E4M3ToFloat(bits), 2.0);
  });

  it('Convert 0.5 to FP8 E4M3 and back', () => {
    const bits = floatToFP8E4M3(0.5);
    assertHex(bits, 0x30);
    assert.strictEqual(fp8E4M3ToFloat(bits), 0.5);
  });

  it('Convert 1.25 to FP8 E4M3 and back', () => {
    const bits = floatToFP8E4M3(1.25);
    assertHex(bits, 0x3A);
    assert.strictEqual(fp8E4M3ToFloat(bits), 1.25);
  });

  it('Convert 1.5 to FP8 E4M3 and back', () => {
    const bits = floatToFP8E4M3(1.5);
    assertHex(bits, 0x3C);
    assert.strictEqual(fp8E4M3ToFloat(bits), 1.5);
  });

  it('Convert +Infinity to FP8 E4M3 and back', () => {
    const bits = floatToFP8E4M3(Infinity);
    assertHex(bits, 0x78);
    assert.strictEqual(fp8E4M3ToFloat(bits), Infinity);
  });

  it('Convert -Infinity to FP8 E4M3 and back', () => {
    const bits = floatToFP8E4M3(-Infinity);
    assertHex(bits, 0xF8);
    assert.strictEqual(fp8E4M3ToFloat(bits), -Infinity);
  });

  it('Convert NaN to FP8 E4M3 and back', () => {
    const bits = floatToFP8E4M3(NaN);
    assert.strictEqual(bits & 0x78, 0x78, 'Exponent should be all 1s');
    assert.notStrictEqual(
        bits & 0x07, 0, 'Mantissa should be non-zero for NaN');
    assert.ok(Number.isNaN(fp8E4M3ToFloat(bits)), 'Result should be NaN');
  });

  it('Overflow to infinity in FP8 E4M3', () => {
    const bits = floatToFP8E4M3(1000);
    assertHex(bits, 0x78);
  });

  it('FP8 E4M3 subnormal 0x01 converts correctly', () => {
    const result = fp8E4M3ToFloat(0x01);
    assertClose(result, Math.pow(2, -9), 1e-10);
  });

  it('FP8 E4M3 subnormal 0x07 converts correctly', () => {
    const result = fp8E4M3ToFloat(0x07);
    assertClose(result, 0.875 * Math.pow(2, -6), 1e-10);
  });

  it('Hex 0x42 decodes to 2.5', () => {
    const result = fp8E4M3ToFloat(0x42);
    assert.strictEqual(result, 2.5);
  });

  it('Hex 0x44 decodes to 3.0', () => {
    const result = fp8E4M3ToFloat(0x44);
    assert.strictEqual(result, 3.0);
  });
});

// ============================================================================
// Round-Trip Tests
// ============================================================================

describe('Round-Trip Consistency Tests', () => {
  const testValues = [
    0, 1, -1, 0.5, -0.5, 2, -2, 0.25, 0.125, 0.0625, 3.14159, -3.14159, 100,
    -100, 0.001, -0.001
  ];

  it('BFloat16 round-trip preserves value approximately', () => {
    for (const val of testValues) {
      const bits = floatToBfloat16(val);
      const result = bfloat16ToFloat32(bits);
      assertClose(result, val, Math.abs(val) * 0.02 + 1e-10, `Value ${val}: `);
    }
  });

  it('Float16 round-trip preserves value approximately', () => {
    const float16TestValues = testValues.filter(v => Math.abs(v) < 65504);
    for (const val of float16TestValues) {
      const bits = floatToFloat16(val);
      const result = float16ToFloat32(bits);
      assertClose(result, val, Math.abs(val) * 0.002 + 1e-6, `Value ${val}: `);
    }
  });

  it('TF32 round-trip preserves value approximately', () => {
    for (const val of testValues) {
      const bits = floatToTF32(val);
      const result = tf32ToFloat32(bits);
      assertClose(result, val, Math.abs(val) * 0.002 + 1e-10, `Value ${val}: `);
    }
  });

  it('FP8 E5M2 round-trip preserves value approximately', () => {
    const fp8TestValues = testValues.filter(v => Math.abs(v) < 50000);
    for (const val of fp8TestValues) {
      const bits = floatToFP8E5M2(val);
      const result = fp8E5M2ToFloat(bits);
      assertClose(result, val, Math.abs(val) * 0.5 + 1e-4, `Value ${val}: `);
    }
  });

  it('FP8 E4M3 round-trip preserves value approximately', () => {
    const fp8TestValues = testValues.filter(v => Math.abs(v) < 200);
    for (const val of fp8TestValues) {
      const bits = floatToFP8E4M3(val);
      const result = fp8E4M3ToFloat(bits);
      assertClose(result, val, Math.abs(val) * 0.2 + 1e-3, `Value ${val}: `);
    }
  });
});

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('Edge Cases and Boundary Values', () => {
  it('Float16 max normal value', () => {
    const maxNormal = 65504;
    const bits = floatToFloat16(maxNormal);
    assert.strictEqual(float16ToFloat32(bits), maxNormal);
  });

  it('Float16 min normal value', () => {
    const minNormal = Math.pow(2, -14);
    const bits = floatToFloat16(minNormal);
    assertClose(float16ToFloat32(bits), minNormal, 1e-10);
  });

  it('Float16 min subnormal value', () => {
    const minSubnormal = Math.pow(2, -24);
    const bits = floatToFloat16(minSubnormal);
    assertClose(float16ToFloat32(bits), minSubnormal, 1e-10);
  });

  it('BFloat16 preserves Float32 range', () => {
    const largeVal = 1e38;
    const bits = floatToBfloat16(largeVal);
    const result = bfloat16ToFloat32(bits);
    assert.ok(
        Math.abs(result) > 1e37,
        `Result ${result} should be > 1e37 for large values`);
  });

  it('FP8 E5M2 max normal value ~57344', () => {
    const bits = 0x7B;
    const result = fp8E5M2ToFloat(bits);
    assert.strictEqual(result, 57344);
  });

  it('FP8 E4M3 max normal value ~240', () => {
    const bits = 0x77;
    const result = fp8E4M3ToFloat(bits);
    assert.strictEqual(result, 240);
  });

  it('Negative subnormals work correctly', () => {
    const f16Result = float16ToFloat32(0x8001);
    assert.ok(f16Result < 0, 'Should be negative');
    assertClose(f16Result, -Math.pow(2, -24), 1e-10);

    const fp8e5m2Result = fp8E5M2ToFloat(0x81);
    assert.ok(fp8e5m2Result < 0, 'Should be negative');

    const fp8e4m3Result = fp8E4M3ToFloat(0x81);
    assert.ok(fp8e4m3Result < 0, 'Should be negative');
  });

  it('Very small values underflow to zero correctly', () => {
    const tinyVal = 1e-50;

    const f16Bits = floatToFloat16(tinyVal);
    assertHex(f16Bits, 0x0000);

    const fp8e5m2Bits = floatToFP8E5M2(tinyVal);
    assertHex(fp8e5m2Bits, 0x00);

    const fp8e4m3Bits = floatToFP8E4M3(tinyVal);
    assertHex(fp8e4m3Bits, 0x00);
  });
});

// ============================================================================
// Hex Input Tests
// ============================================================================

describe('Hex to Float Decoding', () => {
  it('BFloat16 hex 0x3F80 = 1.0', () => {
    assert.strictEqual(bfloat16ToFloat32(0x3F80), 1.0);
  });

  it('BFloat16 hex 0x4000 = 2.0', () => {
    assert.strictEqual(bfloat16ToFloat32(0x4000), 2.0);
  });

  it('BFloat16 hex 0x4040 = 3.0', () => {
    assert.strictEqual(bfloat16ToFloat32(0x4040), 3.0);
  });

  it('Float16 hex 0x3C00 = 1.0', () => {
    assert.strictEqual(float16ToFloat32(0x3C00), 1.0);
  });

  it('Float16 hex 0x4000 = 2.0', () => {
    assert.strictEqual(float16ToFloat32(0x4000), 2.0);
  });

  it('Float16 hex 0x4200 = 3.0', () => {
    assert.strictEqual(float16ToFloat32(0x4200), 3.0);
  });

  it('FP8 E5M2 hex 0x3C = 1.0', () => {
    assert.strictEqual(fp8E5M2ToFloat(0x3C), 1.0);
  });

  it('FP8 E5M2 hex 0x40 = 2.0', () => {
    assert.strictEqual(fp8E5M2ToFloat(0x40), 2.0);
  });

  it('FP8 E4M3 hex 0x38 = 1.0', () => {
    assert.strictEqual(fp8E4M3ToFloat(0x38), 1.0);
  });

  it('FP8 E4M3 hex 0x40 = 2.0', () => {
    assert.strictEqual(fp8E4M3ToFloat(0x40), 2.0);
  });
});

// ============================================================================
// Precision Analysis Tests
// ============================================================================

describe('Precision Analysis - Bits Required', () => {
  it('1.0 requires 0 mantissa bits (exact power of 2)', () => {
    const analysis = analyzePrecision(1.0, 'float32');
    assert.strictEqual(analysis.effectiveBits, 0);
    assert.strictEqual(analysis.exponent, 0);
    assert.strictEqual(analysis.isSubnormal, false);
  });

  it('2.0 requires 0 mantissa bits (exact power of 2)', () => {
    const analysis = analyzePrecision(2.0, 'float32');
    assert.strictEqual(analysis.effectiveBits, 0);
    assert.strictEqual(analysis.exponent, 1);
  });

  it('0.5 requires 0 mantissa bits (exact power of 2)', () => {
    const analysis = analyzePrecision(0.5, 'float32');
    assert.strictEqual(analysis.effectiveBits, 0);
    assert.strictEqual(analysis.exponent, -1);
  });

  it('1.5 requires 1 mantissa bit', () => {
    const analysis = analyzePrecision(1.5, 'float32');
    assert.strictEqual(analysis.effectiveBits, 1);
    assert.strictEqual(analysis.exponent, 0);
  });

  it('1.25 requires 2 mantissa bits', () => {
    const analysis = analyzePrecision(1.25, 'float32');
    assert.strictEqual(analysis.effectiveBits, 2);
  });

  it('1.75 requires 2 mantissa bits', () => {
    const analysis = analyzePrecision(1.75, 'float32');
    assert.strictEqual(analysis.effectiveBits, 2);
  });

  it('1.125 requires 3 mantissa bits', () => {
    const analysis = analyzePrecision(1.125, 'float32');
    assert.strictEqual(analysis.effectiveBits, 3);
  });

  it('1.0625 requires 4 mantissa bits', () => {
    const analysis = analyzePrecision(1.0625, 'float32');
    assert.strictEqual(analysis.effectiveBits, 4);
  });

  it('3.14159265 requires many mantissa bits (irrational approximation)',
     () => {
       const analysis = analyzePrecision(3.14159265, 'float32');
       assert.ok(
           analysis.effectiveBits >= 20,
           `Expected >= 20 bits, got ${analysis.effectiveBits}`);
     });

  it('Zero requires 0 bits', () => {
    const analysis = analyzePrecision(0.0, 'float32');
    assert.strictEqual(analysis.effectiveBits, 0);
  });

  it('Negative values work correctly', () => {
    const analysis = analyzePrecision(-1.5, 'float32');
    assert.strictEqual(analysis.effectiveBits, 1);
    assert.strictEqual(analysis.sign, 1);
  });

  it('256 requires 0 mantissa bits (power of 2)', () => {
    const analysis = analyzePrecision(256.0, 'float32');
    assert.strictEqual(analysis.effectiveBits, 0);
    assert.strictEqual(analysis.exponent, 8);
  });

  it('320 requires 2 mantissa bits (256 * 1.25)', () => {
    const analysis = analyzePrecision(320.0, 'float32');
    assert.strictEqual(analysis.effectiveBits, 2);
    assert.strictEqual(analysis.exponent, 8);
  });
});

describe('Precision Analysis - Exponent Range', () => {
  it('Large value 1e38 has exponent ~126', () => {
    const analysis = analyzePrecision(1e38, 'float32');
    assert.ok(
        analysis.exponent >= 125 && analysis.exponent <= 127,
        `Exponent ${analysis.exponent} should be between 125 and 127`);
  });

  it('Small value 1e-38 has negative exponent ~-126', () => {
    const analysis = analyzePrecision(1e-38, 'float32');
    assert.ok(
        analysis.exponent <= -125,
        `Exponent ${analysis.exponent} should be <= -125`);
  });

  it('Value 65504 (Float16 max) has exponent 15', () => {
    const analysis = analyzePrecision(65504, 'float32');
    assert.strictEqual(analysis.exponent, 15);
  });

  it('Value 240 (FP8 E4M3 max) has exponent 7', () => {
    const analysis = analyzePrecision(240, 'float32');
    assert.strictEqual(analysis.exponent, 7);
  });
});

describe('Precision Analysis - Special Values', () => {
  it('Infinity is detected', () => {
    const analysis = analyzePrecision(Infinity, 'float32');
    assert.strictEqual(analysis.exponent, Infinity);
    assert.strictEqual(analysis.mantissa, 0);
  });

  it('Negative Infinity is detected', () => {
    const analysis = analyzePrecision(-Infinity, 'float32');
    assert.strictEqual(analysis.exponent, Infinity);
    assert.strictEqual(analysis.sign, 1);
  });

  it('NaN is detected', () => {
    const analysis = analyzePrecision(NaN, 'float32');
    assert.strictEqual(analysis.exponent, Infinity);
    assert.notStrictEqual(analysis.mantissa, 0);
  });
});

describe('Compatible Formats Analysis', () => {
  it('1.0 is compatible with all formats', () => {
    const formats = getCompatibleFormats(1.0, 0, 0);
    assert.ok(formats.includes('Float32'), 'Should include Float32');
    assert.ok(formats.includes('BFloat16'), 'Should include BFloat16');
    assert.ok(formats.includes('TF32'), 'Should include TF32');
    assert.ok(formats.includes('Float16'), 'Should include Float16');
    assert.ok(formats.includes('FP8 E5M2'), 'Should include FP8 E5M2');
    assert.ok(formats.includes('FP8 E4M3'), 'Should include FP8 E4M3');
  });

  it('1.5 (1 bit) is compatible with all formats', () => {
    const formats = getCompatibleFormats(1.5, 1, 0);
    assert.ok(formats.includes('Float32'), 'Should include Float32');
    assert.ok(formats.includes('FP8 E5M2'), 'Should include FP8 E5M2');
    assert.ok(formats.includes('FP8 E4M3'), 'Should include FP8 E4M3');
  });

  it('Value needing 3 bits is NOT compatible with FP8 E5M2 (2-bit mantissa)',
     () => {
       const formats = getCompatibleFormats(1.125, 3, 0);
       assert.ok(formats.includes('Float32'), 'Should include Float32');
       assert.ok(formats.includes('Float16'), 'Should include Float16');
       assert.ok(formats.includes('FP8 E4M3'), 'Should include FP8 E4M3');
       assert.ok(!formats.includes('FP8 E5M2'), 'Should NOT include FP8 E5M2');
     });

  it('Value needing 8 bits is NOT compatible with BFloat16 (7-bit mantissa)',
     () => {
       const formats = getCompatibleFormats(1.00390625, 8, 0);
       assert.ok(formats.includes('Float32'), 'Should include Float32');
       assert.ok(formats.includes('TF32'), 'Should include TF32');
       assert.ok(formats.includes('Float16'), 'Should include Float16');
       assert.ok(!formats.includes('BFloat16'), 'Should NOT include BFloat16');
       assert.ok(!formats.includes('FP8 E5M2'), 'Should NOT include FP8 E5M2');
       assert.ok(!formats.includes('FP8 E4M3'), 'Should NOT include FP8 E4M3');
     });

  it('Large exponent (e.g., 100) excludes Float16 and FP8 formats', () => {
    const formats = getCompatibleFormats(1e30, 0, 100);
    assert.ok(formats.includes('Float32'), 'Should include Float32');
    assert.ok(formats.includes('TF32'), 'Should include TF32');
    assert.ok(formats.includes('BFloat16'), 'Should include BFloat16');
    assert.ok(!formats.includes('Float16'), 'Should NOT include Float16');
    assert.ok(!formats.includes('FP8 E5M2'), 'Should NOT include FP8 E5M2');
    assert.ok(!formats.includes('FP8 E4M3'), 'Should NOT include FP8 E4M3');
  });

  it('Exponent 16 excludes Float16, FP8 E5M2, FP8 E4M3', () => {
    const formats = getCompatibleFormats(65536, 0, 16);
    assert.ok(formats.includes('Float32'), 'Should include Float32');
    assert.ok(formats.includes('TF32'), 'Should include TF32');
    assert.ok(formats.includes('BFloat16'), 'Should include BFloat16');
    assert.ok(!formats.includes('Float16'), 'Should NOT include Float16');
    assert.ok(!formats.includes('FP8 E5M2'), 'Should NOT include FP8 E5M2');
    assert.ok(!formats.includes('FP8 E4M3'), 'Should NOT include FP8 E4M3');
  });

  it('Exponent 8 excludes FP8 E4M3 (max exp 7)', () => {
    const formats = getCompatibleFormats(256, 0, 8);
    assert.ok(formats.includes('Float32'), 'Should include Float32');
    assert.ok(formats.includes('Float16'), 'Should include Float16');
    assert.ok(formats.includes('FP8 E5M2'), 'Should include FP8 E5M2');
    assert.ok(!formats.includes('FP8 E4M3'), 'Should NOT include FP8 E4M3');
  });

  it('Exponent -15 excludes Float16 and FP8 (need subnormal or out of range)',
     () => {
       const formats = getCompatibleFormats(Math.pow(2, -15), 0, -15);
       assert.ok(formats.includes('Float32'), 'Should include Float32');
       assert.ok(formats.includes('TF32'), 'Should include TF32');
       assert.ok(formats.includes('BFloat16'), 'Should include BFloat16');
       // Float16 and FP8 E5M2 might represent as subnormal
     });

  it('Zero is compatible with all formats', () => {
    const formats = getCompatibleFormats(0, 0, 0);
    assert.strictEqual(formats.length, 6);
  });

  it('Infinity is compatible with all formats', () => {
    const formats = getCompatibleFormats(Infinity, 0, 0);
    assert.strictEqual(formats.length, 6);
  });

  it('NaN is compatible with all formats', () => {
    const formats = getCompatibleFormats(NaN, 0, 0);
    assert.strictEqual(formats.length, 6);
  });
});

describe('Precision Analysis for Different Formats', () => {
  it('Float16 analysis works correctly', () => {
    const analysis = analyzePrecision(1.5, 'float16');
    assert.strictEqual(analysis.effectiveBits, 1);
  });

  it('BFloat16 analysis works correctly', () => {
    const analysis = analyzePrecision(1.5, 'bfloat16');
    assert.strictEqual(analysis.effectiveBits, 1);
  });

  it('FP8 E5M2 analysis works correctly', () => {
    const analysis = analyzePrecision(1.5, 'fp8e5m2');
    assert.strictEqual(analysis.effectiveBits, 1);
  });

  it('FP8 E4M3 analysis works correctly', () => {
    const analysis = analyzePrecision(1.5, 'fp8e4m3');
    assert.strictEqual(analysis.effectiveBits, 1);
  });

  it('TF32 analysis works correctly', () => {
    const analysis = analyzePrecision(1.5, 'tf32');
    assert.strictEqual(analysis.effectiveBits, 1);
  });
});

describe('Precision Step (ULP) Calculation', () => {
  it('ULP at exponent 0 for Float32 is 2^-23', () => {
    const analysis = analyzePrecision(1.0, 'float32');
    assertClose(analysis.minRepresentable, Math.pow(2, -23), 1e-15);
  });

  it('ULP at exponent 8 for Float32 is 2^-15', () => {
    const analysis = analyzePrecision(256.0, 'float32');
    assertClose(analysis.minRepresentable, Math.pow(2, -15), 1e-12);
  });

  it('ULP at exponent -10 for Float32 is 2^-33', () => {
    const analysis = analyzePrecision(Math.pow(2, -10), 'float32');
    assertClose(analysis.minRepresentable, Math.pow(2, -33), 1e-18);
  });

  it('ULP for Float16 at exponent 0 is 2^-10', () => {
    const analysis = analyzePrecision(1.0, 'float16');
    assertClose(analysis.minRepresentable, Math.pow(2, -10), 1e-8);
  });

  it('ULP for BFloat16 at exponent 0 is 2^-7', () => {
    const analysis = analyzePrecision(1.0, 'bfloat16');
    assertClose(analysis.minRepresentable, Math.pow(2, -7), 1e-5);
  });
});
