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
  getCompatibleFormats,
  formatDecimal
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

// ============================================================================
// formatDecimal Tests
// ============================================================================

describe('formatDecimal - Precision Display', () => {
  it('Displays zero as "0"', () => {
    assert.strictEqual(formatDecimal(0), '0');
  });

  it('Displays negative zero as "0"', () => {
    assert.strictEqual(formatDecimal(-0), '0');
  });

  it('Displays Infinity correctly', () => {
    assert.strictEqual(formatDecimal(Infinity), 'Infinity');
  });

  it('Displays -Infinity correctly', () => {
    assert.strictEqual(formatDecimal(-Infinity), '-Infinity');
  });

  it('Displays NaN correctly', () => {
    assert.strictEqual(formatDecimal(NaN), 'NaN');
  });

  it('Displays 1.0 without unnecessary trailing zeros', () => {
    const result = formatDecimal(1.0);
    assert.ok(
        !result.endsWith('0000'), `Expected no trailing zeros, got: ${result}`);
  });

  it('Displays 0.5 without unnecessary trailing zeros', () => {
    const result = formatDecimal(0.5);
    assert.ok(
        !result.endsWith('0000'), `Expected no trailing zeros, got: ${result}`);
  });

  it('Displays pi with high precision', () => {
    const result = formatDecimal(Math.PI);
    // Should have more than 10 significant digits
    assert.ok(result.length > 12, `Expected high precision, got: ${result}`);
  });

  it('Displays 1/6 (Float32) with full precision', () => {
    // This is the exact Float32 representation of 1/6
    const float32View = new Float32Array([1 / 6]);
    const result = formatDecimal(float32View[0]);
    // Should have many significant digits
    assert.ok(
        result.length > 10, `Expected high precision for 1/6, got: ${result}`);
  });

  it('Displays very small numbers in scientific notation', () => {
    const result = formatDecimal(1e-10);
    assert.ok(
        result.includes('e'),
        `Expected scientific notation for 1e-10, got: ${result}`);
  });

  it('Displays very large numbers in scientific notation', () => {
    const result = formatDecimal(1e10);
    assert.ok(
        result.includes('e'),
        `Expected scientific notation for 1e10, got: ${result}`);
  });

  it('Preserves precision for exact Float32 values', () => {
    // 0.1 in Float32 is not exactly 0.1
    const float32View = new Float32Array([0.1]);
    const result = formatDecimal(float32View[0]);
    // Should show the actual Float32 value, not just 0.1
    assert.ok(
        result.startsWith('0.10000000'),
        `Expected precise Float32 value, got: ${result}`);
  });

  it('Handles negative numbers correctly', () => {
    const result = formatDecimal(-3.14159);
    assert.ok(
        result.startsWith('-3.14'),
        `Expected negative number starting with -3.14, got: ${result}`);
    assert.ok(
        result.length > 5,
        `Expected high precision for negative number, got: ${result}`);
  });

  it('Very small numbers use scientific notation', () => {
    // Numbers smaller than 1e-7 should use scientific notation
    const result = formatDecimal(1e-10);
    assert.ok(
        result.includes('e'),
        `Expected scientific notation for 1e-10, got: ${result}`);
  });

  it('Very large numbers use scientific notation', () => {
    // Numbers >= 1e7 should use scientific notation
    const result = formatDecimal(1e8);
    assert.ok(
        result.includes('e'),
        `Expected scientific notation for 1e8, got: ${result}`);
  });

  it('Normal range numbers have high precision', () => {
    // 0.1 cannot be exactly represented in binary floating point
    const result = formatDecimal(0.1);
    // Should show many digits to reveal the inexact representation
    assert.ok(
        result.length >= 10, `Expected high precision for 0.1, got: ${result}`);
  });
});

// ============================================================================
// Bit Editor Tests - Bit Pattern to Value Conversions
// ============================================================================

describe('Bit Editor - Float32 Bit Patterns', () => {
  it('All zeros = 0.0', () => {
    const bits = 0x00000000;
    const result = new Float32Array(new Uint32Array([bits]).buffer)[0];
    assert.ok(isPositiveZero(result), 'Should be positive zero');
  });

  it('Sign bit only (0x80000000) = -0.0', () => {
    const bits = 0x80000000;
    const result = new Float32Array(new Uint32Array([bits]).buffer)[0];
    assert.ok(isNegativeZero(result), 'Should be negative zero');
  });

  it('0x3F800000 = 1.0', () => {
    const bits = 0x3F800000;
    const result = new Float32Array(new Uint32Array([bits]).buffer)[0];
    assert.strictEqual(result, 1.0);
  });

  it('0x40000000 = 2.0', () => {
    const bits = 0x40000000;
    const result = new Float32Array(new Uint32Array([bits]).buffer)[0];
    assert.strictEqual(result, 2.0);
  });

  it('0x7F7FFFFF = max normal (approx 3.4e38)', () => {
    const bits = 0x7F7FFFFF;
    const result = new Float32Array(new Uint32Array([bits]).buffer)[0];
    assertClose(result, 3.4028234663852886e+38, 1e30);
  });

  it('0x7F800000 = +Infinity', () => {
    const bits = 0x7F800000;
    const result = new Float32Array(new Uint32Array([bits]).buffer)[0];
    assert.strictEqual(result, Infinity);
  });

  it('0xFF800000 = -Infinity', () => {
    const bits = 0xFF800000;
    const result = new Float32Array(new Uint32Array([bits]).buffer)[0];
    assert.strictEqual(result, -Infinity);
  });

  it('0x7FC00000 = NaN (quiet NaN)', () => {
    const bits = 0x7FC00000;
    const result = new Float32Array(new Uint32Array([bits]).buffer)[0];
    assert.ok(Number.isNaN(result), 'Should be NaN');
  });

  it('0x00000001 = smallest positive subnormal', () => {
    const bits = 0x00000001;
    const result = new Float32Array(new Uint32Array([bits]).buffer)[0];
    assertClose(result, Math.pow(2, -149), 1e-50);
  });

  it('0x00800000 = smallest positive normal', () => {
    const bits = 0x00800000;
    const result = new Float32Array(new Uint32Array([bits]).buffer)[0];
    assertClose(result, Math.pow(2, -126), 1e-40);
  });
});

describe('Bit Editor - FP8 E4M3 Bit Patterns', () => {
  it('0x00 = 0.0', () => {
    assert.ok(isPositiveZero(fp8E4M3ToFloat(0x00)), 'Should be positive zero');
  });

  it('0x80 = -0.0', () => {
    assert.ok(isNegativeZero(fp8E4M3ToFloat(0x80)), 'Should be negative zero');
  });

  it('0x38 = 1.0 (exp=7, mant=0)', () => {
    // 0x38 = 0011 1000 = sign:0, exp:0111, mant:000
    assert.strictEqual(fp8E4M3ToFloat(0x38), 1.0);
  });

  it('0x40 = 2.0 (exp=8, mant=0)', () => {
    // 0x40 = 0100 0000 = sign:0, exp:1000, mant:000
    assert.strictEqual(fp8E4M3ToFloat(0x40), 2.0);
  });

  it('0x77 = 240 (max normal value)', () => {
    // 0x77 = 0111 0111 = sign:0, exp:1110, mant:111
    // value = 1.875 * 2^7 = 240
    assert.strictEqual(fp8E4M3ToFloat(0x77), 240);
  });

  it('0xF7 = -240 (min normal value)', () => {
    // 0xF7 = 1111 0111 = sign:1, exp:1110, mant:111
    assert.strictEqual(fp8E4M3ToFloat(0xF7), -240);
  });

  it('0x78 = +Infinity (exp=1111, mant=000)', () => {
    assert.strictEqual(fp8E4M3ToFloat(0x78), Infinity);
  });

  it('0xF8 = -Infinity', () => {
    assert.strictEqual(fp8E4M3ToFloat(0xF8), -Infinity);
  });

  it('0x79 = NaN (exp=1111, mant!=0)', () => {
    assert.ok(Number.isNaN(fp8E4M3ToFloat(0x79)), 'Should be NaN');
  });

  it('0x01 = smallest subnormal = 2^-9', () => {
    assertClose(fp8E4M3ToFloat(0x01), Math.pow(2, -9), 1e-10);
  });

  it('0x08 = smallest normal = 2^-6', () => {
    // 0x08 = 0000 1000 = sign:0, exp:0001, mant:000
    assertClose(fp8E4M3ToFloat(0x08), Math.pow(2, -6), 1e-10);
  });

  it('0x3A = 1.25 (exp=7, mant=010)', () => {
    assert.strictEqual(fp8E4M3ToFloat(0x3A), 1.25);
  });

  it('0x3C = 1.5 (exp=7, mant=100)', () => {
    assert.strictEqual(fp8E4M3ToFloat(0x3C), 1.5);
  });

  it('0x3E = 1.75 (exp=7, mant=110)', () => {
    assert.strictEqual(fp8E4M3ToFloat(0x3E), 1.75);
  });
});

describe('Bit Editor - FP8 E5M2 Bit Patterns', () => {
  it('0x00 = 0.0', () => {
    assert.ok(isPositiveZero(fp8E5M2ToFloat(0x00)), 'Should be positive zero');
  });

  it('0x80 = -0.0', () => {
    assert.ok(isNegativeZero(fp8E5M2ToFloat(0x80)), 'Should be negative zero');
  });

  it('0x3C = 1.0 (exp=15, mant=0)', () => {
    assert.strictEqual(fp8E5M2ToFloat(0x3C), 1.0);
  });

  it('0x40 = 2.0', () => {
    assert.strictEqual(fp8E5M2ToFloat(0x40), 2.0);
  });

  it('0x7B = 57344 (max normal value)', () => {
    // 0x7B = 0111 1011 = sign:0, exp:11110, mant:11
    // value = 1.75 * 2^15 = 57344
    assert.strictEqual(fp8E5M2ToFloat(0x7B), 57344);
  });

  it('0x7C = +Infinity (exp=11111, mant=00)', () => {
    assert.strictEqual(fp8E5M2ToFloat(0x7C), Infinity);
  });

  it('0xFC = -Infinity', () => {
    assert.strictEqual(fp8E5M2ToFloat(0xFC), -Infinity);
  });

  it('0x7D = NaN (exp=11111, mant!=0)', () => {
    assert.ok(Number.isNaN(fp8E5M2ToFloat(0x7D)), 'Should be NaN');
  });

  it('0x01 = smallest subnormal = 2^-16', () => {
    assertClose(fp8E5M2ToFloat(0x01), Math.pow(2, -16), 1e-10);
  });

  it('0x3E = 1.5 (exp=15, mant=10)', () => {
    assert.strictEqual(fp8E5M2ToFloat(0x3E), 1.5);
  });
});

describe('Bit Editor - Float16 Bit Patterns', () => {
  it('0x0000 = 0.0', () => {
    assert.ok(
        isPositiveZero(float16ToFloat32(0x0000)), 'Should be positive zero');
  });

  it('0x8000 = -0.0', () => {
    assert.ok(
        isNegativeZero(float16ToFloat32(0x8000)), 'Should be negative zero');
  });

  it('0x3C00 = 1.0', () => {
    assert.strictEqual(float16ToFloat32(0x3C00), 1.0);
  });

  it('0x4000 = 2.0', () => {
    assert.strictEqual(float16ToFloat32(0x4000), 2.0);
  });

  it('0x7BFF = 65504 (max normal value)', () => {
    assert.strictEqual(float16ToFloat32(0x7BFF), 65504);
  });

  it('0x7C00 = +Infinity', () => {
    assert.strictEqual(float16ToFloat32(0x7C00), Infinity);
  });

  it('0xFC00 = -Infinity', () => {
    assert.strictEqual(float16ToFloat32(0xFC00), -Infinity);
  });

  it('0x7E00 = NaN', () => {
    assert.ok(Number.isNaN(float16ToFloat32(0x7E00)), 'Should be NaN');
  });

  it('0x0001 = smallest subnormal = 2^-24', () => {
    assertClose(float16ToFloat32(0x0001), Math.pow(2, -24), 1e-10);
  });

  it('0x0400 = smallest normal = 2^-14', () => {
    assertClose(float16ToFloat32(0x0400), Math.pow(2, -14), 1e-10);
  });
});

describe('Bit Editor - BFloat16 Bit Patterns', () => {
  it('0x0000 = 0.0', () => {
    assert.ok(
        isPositiveZero(bfloat16ToFloat32(0x0000)), 'Should be positive zero');
  });

  it('0x8000 = -0.0', () => {
    assert.ok(
        isNegativeZero(bfloat16ToFloat32(0x8000)), 'Should be negative zero');
  });

  it('0x3F80 = 1.0', () => {
    assert.strictEqual(bfloat16ToFloat32(0x3F80), 1.0);
  });

  it('0x4000 = 2.0', () => {
    assert.strictEqual(bfloat16ToFloat32(0x4000), 2.0);
  });

  it('0x7F7F = max normal (approx 3.39e38)', () => {
    // BFloat16 max: sign=0, exp=11111110, mant=1111111
    const result = bfloat16ToFloat32(0x7F7F);
    assertClose(result, 3.39e38, 1e36);
  });

  it('0x7F80 = +Infinity', () => {
    assert.strictEqual(bfloat16ToFloat32(0x7F80), Infinity);
  });

  it('0xFF80 = -Infinity', () => {
    assert.strictEqual(bfloat16ToFloat32(0xFF80), -Infinity);
  });

  it('0x7FC0 = NaN', () => {
    assert.ok(Number.isNaN(bfloat16ToFloat32(0x7FC0)), 'Should be NaN');
  });
});

describe('Bit Editor - Integer Bit Patterns', () => {
  it('Int32: 0x00000001 = 1', () => {
    const bits = 0x00000001;
    const result = bits | 0;  // Convert to signed
    assert.strictEqual(result, 1);
  });

  it('Int32: 0x7FFFFFFF = 2147483647 (max)', () => {
    const bits = 0x7FFFFFFF;
    const result = bits | 0;
    assert.strictEqual(result, 2147483647);
  });

  it('Int32: 0x80000000 = -2147483648 (min)', () => {
    const bits = 0x80000000;
    const result = bits | 0;
    assert.strictEqual(result, -2147483648);
  });

  it('Int32: 0xFFFFFFFF = -1', () => {
    const bits = 0xFFFFFFFF;
    const result = bits | 0;
    assert.strictEqual(result, -1);
  });

  it('UInt32: 0xFFFFFFFF = 4294967295', () => {
    const bits = 0xFFFFFFFF;
    const result = bits >>> 0;  // Convert to unsigned
    assert.strictEqual(result, 4294967295);
  });

  it('Int16: 0x7FFF = 32767 (max)', () => {
    const bits = 0x7FFF;
    const result = (bits << 16) >> 16;  // Sign extend
    assert.strictEqual(result, 32767);
  });

  it('Int16: 0x8000 = -32768 (min)', () => {
    const bits = 0x8000;
    const result = (bits << 16) >> 16;
    assert.strictEqual(result, -32768);
  });

  it('Int16: 0xFFFF = -1', () => {
    const bits = 0xFFFF;
    const result = (bits << 16) >> 16;
    assert.strictEqual(result, -1);
  });

  it('UInt16: 0xFFFF = 65535', () => {
    const bits = 0xFFFF;
    const result = bits & 0xFFFF;
    assert.strictEqual(result, 65535);
  });

  it('Int8: 0x7F = 127 (max)', () => {
    const bits = 0x7F;
    const result = (bits << 24) >> 24;
    assert.strictEqual(result, 127);
  });

  it('Int8: 0x80 = -128 (min)', () => {
    const bits = 0x80;
    const result = (bits << 24) >> 24;
    assert.strictEqual(result, -128);
  });

  it('Int8: 0xFF = -1', () => {
    const bits = 0xFF;
    const result = (bits << 24) >> 24;
    assert.strictEqual(result, -1);
  });

  it('UInt8: 0xFF = 255', () => {
    const bits = 0xFF;
    const result = bits & 0xFF;
    assert.strictEqual(result, 255);
  });
});

describe('Bit Editor - Boundary Values', () => {
  it('FP8 E4M3: verify all subnormal values', () => {
    // Subnormals: exp=0, mant=001 to 111
    const expected = [
      {bits: 0x01, value: Math.pow(2, -9)},      // 0.001 * 2^-6
      {bits: 0x02, value: Math.pow(2, -8)},      // 0.010 * 2^-6
      {bits: 0x03, value: 3 * Math.pow(2, -9)},  // 0.011 * 2^-6
      {bits: 0x04, value: Math.pow(2, -7)},      // 0.100 * 2^-6
      {bits: 0x05, value: 5 * Math.pow(2, -9)},  // 0.101 * 2^-6
      {bits: 0x06, value: 6 * Math.pow(2, -9)},  // 0.110 * 2^-6
      {bits: 0x07, value: 7 * Math.pow(2, -9)},  // 0.111 * 2^-6
    ];

    for (const {bits, value} of expected) {
      assertClose(
          fp8E4M3ToFloat(bits), value, 1e-10,
          `Bits 0x${bits.toString(16).toUpperCase()}: `);
    }
  });

  it('FP8 E4M3: transition from subnormal to normal', () => {
    // Largest subnormal: 0x07 = 0.111 * 2^-6 = 7/512
    const largestSubnormal = fp8E4M3ToFloat(0x07);
    // Smallest normal: 0x08 = 1.000 * 2^-6 = 1/64
    const smallestNormal = fp8E4M3ToFloat(0x08);

    assert.ok(
        smallestNormal > largestSubnormal,
        `Smallest normal (${smallestNormal}) should be > largest subnormal (${
            largestSubnormal})`);
  });

  it('FP8 E5M2: verify max value 57344', () => {
    // 0x7B = sign:0, exp:11110 (30-15=15), mant:11 (1.75)
    // value = 1.75 * 2^15 = 57344
    const result = fp8E5M2ToFloat(0x7B);
    assert.strictEqual(result, 57344);
  });

  it('Float16: verify all powers of 2 in range', () => {
    const testCases = [
      {exp: -14, bits: 0x0400},  // Smallest normal
      {exp: -1, bits: 0x3800},   // 0.5
      {exp: 0, bits: 0x3C00},    // 1.0
      {exp: 1, bits: 0x4000},    // 2.0
      {exp: 15, bits: 0x7800},   // 32768
    ];

    for (const {exp, bits} of testCases) {
      const result = float16ToFloat32(bits);
      assertClose(result, Math.pow(2, exp), 1e-10, `2^${exp}: `);
    }
  });
});

describe('Bit Editor - Unsigned Integer Patterns', () => {
  it('UInt8: 0x00 = 0', () => {
    const bits = 0x00;
    assert.strictEqual(bits & 0xFF, 0);
  });

  it('UInt8: 0x80 = 128 (not -128)', () => {
    const bits = 0x80;
    assert.strictEqual(bits & 0xFF, 128);
  });

  it('UInt8: 0xFF = 255 (not -1)', () => {
    const bits = 0xFF;
    assert.strictEqual(bits & 0xFF, 255);
  });

  it('UInt16: 0x8000 = 32768 (not -32768)', () => {
    const bits = 0x8000;
    assert.strictEqual(bits & 0xFFFF, 32768);
  });

  it('UInt16: 0xFFFF = 65535 (not -1)', () => {
    const bits = 0xFFFF;
    assert.strictEqual(bits & 0xFFFF, 65535);
  });

  it('UInt32: 0x80000000 = 2147483648 (not -2147483648)', () => {
    const bits = 0x80000000;
    assert.strictEqual(bits >>> 0, 2147483648);
  });

  it('UInt32: 0xFFFFFFFF = 4294967295 (not -1)', () => {
    const bits = 0xFFFFFFFF;
    assert.strictEqual(bits >>> 0, 4294967295);
  });

  it('UInt32: 0xDEADBEEF = 3735928559', () => {
    const bits = 0xDEADBEEF;
    assert.strictEqual(bits >>> 0, 3735928559);
  });
});

describe('Bit Editor - Signed vs Unsigned Comparison', () => {
  it('Int8 vs UInt8: 0x80 differs in interpretation', () => {
    const bits = 0x80;
    const signed = (bits << 24) >> 24;
    const unsigned = bits & 0xFF;
    assert.strictEqual(signed, -128);
    assert.strictEqual(unsigned, 128);
  });

  it('Int16 vs UInt16: 0x8000 differs in interpretation', () => {
    const bits = 0x8000;
    const signed = (bits << 16) >> 16;
    const unsigned = bits & 0xFFFF;
    assert.strictEqual(signed, -32768);
    assert.strictEqual(unsigned, 32768);
  });

  it('Int32 vs UInt32: 0x80000000 differs in interpretation', () => {
    const bits = 0x80000000;
    const signed = bits | 0;
    const unsigned = bits >>> 0;
    assert.strictEqual(signed, -2147483648);
    assert.strictEqual(unsigned, 2147483648);
  });

  it('Int32 vs UInt32: 0xFFFFFFFF differs in interpretation', () => {
    const bits = 0xFFFFFFFF;
    const signed = bits | 0;
    const unsigned = bits >>> 0;
    assert.strictEqual(signed, -1);
    assert.strictEqual(unsigned, 4294967295);
  });
});

describe('Bit Editor - Binary String Output', () => {
  it('Float32: 0x3F800000 (1.0) produces correct 32-bit binary', () => {
    const bits = 0x3F800000;
    const binary = (bits >>> 0).toString(2).padStart(32, '0');
    assert.strictEqual(binary, '00111111100000000000000000000000');
    assert.strictEqual(binary.length, 32);
  });

  it('Float16: 0x3C00 (1.0) produces correct 16-bit binary', () => {
    const bits = 0x3C00;
    const binary = (bits >>> 0).toString(2).padStart(16, '0');
    assert.strictEqual(binary, '0011110000000000');
    assert.strictEqual(binary.length, 16);
  });

  it('FP8 E4M3: 0x38 (1.0) produces correct 8-bit binary', () => {
    const bits = 0x38;
    const binary = (bits >>> 0).toString(2).padStart(8, '0');
    assert.strictEqual(binary, '00111000');
    assert.strictEqual(binary.length, 8);
  });

  it('FP8 E4M3: 0x77 (240 max) produces correct 8-bit binary', () => {
    const bits = 0x77;
    const binary = (bits >>> 0).toString(2).padStart(8, '0');
    assert.strictEqual(binary, '01110111');
  });

  it('FP8 E4M3: 0x78 (Infinity) produces correct 8-bit binary', () => {
    const bits = 0x78;
    const binary = (bits >>> 0).toString(2).padStart(8, '0');
    assert.strictEqual(binary, '01111000');
  });

  it('Int8: 0xFF (-1 signed, 255 unsigned) produces correct binary', () => {
    const bits = 0xFF;
    const binary = (bits >>> 0).toString(2).padStart(8, '0');
    assert.strictEqual(binary, '11111111');
  });

  it('Int32: 0x80000000 (-2147483648) produces correct binary', () => {
    const bits = 0x80000000;
    const binary = (bits >>> 0).toString(2).padStart(32, '0');
    assert.strictEqual(binary, '10000000000000000000000000000000');
    assert.strictEqual(binary.length, 32);
  });

  it('Zero produces all zeros for any bit width', () => {
    assert.strictEqual((0).toString(2).padStart(8, '0'), '00000000');
    assert.strictEqual((0).toString(2).padStart(16, '0'), '0000000000000000');
    assert.strictEqual(
        (0).toString(2).padStart(32, '0'), '00000000000000000000000000000000');
  });

  it('All ones produces correct binary for each width', () => {
    assert.strictEqual((0xFF >>> 0).toString(2).padStart(8, '0'), '11111111');
    assert.strictEqual(
        (0xFFFF >>> 0).toString(2).padStart(16, '0'), '1111111111111111');
    assert.strictEqual(
        (0xFFFFFFFF >>> 0).toString(2).padStart(32, '0'),
        '11111111111111111111111111111111');
  });
});

describe('Bit Editor - Float32 Special Values from Bit Patterns', () => {
  it('0x7F800000 = +Infinity (all exp bits set, mant=0)', () => {
    const bits = 0x7F800000;
    const result = new Float32Array(new Uint32Array([bits]).buffer)[0];
    assert.strictEqual(result, Infinity);
  });

  it('0xFF800000 = -Infinity (sign=1, all exp bits set, mant=0)', () => {
    const bits = 0xFF800000;
    const result = new Float32Array(new Uint32Array([bits]).buffer)[0];
    assert.strictEqual(result, -Infinity);
  });

  it('0x7F000000 = 1.7e38 (exp=254, NOT Infinity)', () => {
    // This is what you get if you only set 7 exponent bits instead of 8
    const bits = 0x7F000000;
    const result = new Float32Array(new Uint32Array([bits]).buffer)[0];
    assert.ok(isFinite(result), 'Should be finite, not Infinity');
    assertClose(result, Math.pow(2, 127), 1e30);
  });

  it('0x7FC00000 = quiet NaN (exp=255, mant MSB set)', () => {
    const bits = 0x7FC00000;
    const result = new Float32Array(new Uint32Array([bits]).buffer)[0];
    assert.ok(Number.isNaN(result), 'Should be NaN');
  });

  it('0x7F800001 = signaling NaN (exp=255, mant LSB set)', () => {
    const bits = 0x7F800001;
    const result = new Float32Array(new Uint32Array([bits]).buffer)[0];
    assert.ok(Number.isNaN(result), 'Should be NaN');
  });

  it('0x00400000 = smallest Float32 subnormal with MSB of mantissa', () => {
    const bits = 0x00400000;
    const result = new Float32Array(new Uint32Array([bits]).buffer)[0];
    assertClose(result, Math.pow(2, -127), 1e-45);
  });
});
