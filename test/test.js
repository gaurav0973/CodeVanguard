/**
 * Divides two numbers.
 * @param {number} a - The dividend.
 * @param {number} b - The divisor.
 * @returns {number} The result of the division.
 * @throws {Error} If division by zero occurs.
 */
function divide(a, b) {
    if (b === 0) {
        throw new Error("Division by zero is not allowed.");
    }
    return a / b;
}