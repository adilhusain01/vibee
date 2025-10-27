import { Buffer } from 'buffer';
import process from 'process';

// Make Buffer and process available globally
window.Buffer = Buffer;
window.process = process;
globalThis.Buffer = Buffer;
globalThis.process = process;