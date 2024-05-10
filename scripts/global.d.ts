export {};

declare global {
    interface Window {
        e: any;  // Specify a more precise type if possible
    }
}