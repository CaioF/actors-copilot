/** @jest-environment jsdom */
import { extractVideoThumbnail } from "./extract-thumbnail";

describe("extractVideoThumbnail", () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let mockVideoElement: HTMLVideoElement;

  beforeAll(() => {
    // Preserve originals
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;

    // Mock URL APIs
    URL.createObjectURL = jest.fn(() => "blob:test-url");
    URL.revokeObjectURL = jest.fn();

    // Mock HTMLCanvasElement
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
      drawImage: jest.fn(),
    }) as any;

    HTMLCanvasElement.prototype.toBlob = jest.fn(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string
    ) {
      callback(new Blob(["mock-image-data"], { type: type || "image/png" }));
    });
  });

  beforeEach(() => {
    // SENIOR FIX: Intercept document.createElement to capture the off-screen video reference
    // This allows us to test memory-only DOM nodes without appending them to document.body
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const el = originalCreateElement(tagName, options);
      if (tagName === 'video') {
        mockVideoElement = el as HTMLVideoElement;
      }
      return el;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    // Restore originals
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  const createMockFile = () => new File(["mock-video"], "test.mp4", { type: "video/mp4" });

  it("should resolve with a JPEG Blob from a valid video", async () => {
    const file = createMockFile();
    const promise = extractVideoThumbnail(file);

    // Retrieve the intercepted off-screen video element
    const video = mockVideoElement;
    
    // Simulate metadata load
    Object.defineProperty(video, 'videoWidth', { value: 1920, writable: true });
    Object.defineProperty(video, 'videoHeight', { value: 1080, writable: true });
    Object.defineProperty(video, 'duration', { value: 10, writable: true });
    if (video.onloadedmetadata) video.onloadedmetadata(new Event("loadedmetadata"));
    
    // Simulate seek completion
    if (video.onseeked) video.onseeked(new Event("seeked"));

    const blob = await promise;
    expect(blob.type).toBe("image/jpeg");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });

  it("should extract frame at specified time (default 0.1)", async () => {
    const file = createMockFile();
    const promise = extractVideoThumbnail(file);

    const video = mockVideoElement;
    Object.defineProperty(video, 'duration', { value: 10, writable: true });
    if (video.onloadedmetadata) video.onloadedmetadata(new Event("loadedmetadata"));
    
    expect(video.currentTime).toBe(0.1);
    
    if (video.onseeked) video.onseeked(new Event("seeked"));
    await promise;
  });

  it("should reject if video fails to load", async () => {
    const file = createMockFile();
    const promise = extractVideoThumbnail(file);

    const video = mockVideoElement;
    if (video.onerror) video.onerror("error" as any);

    await expect(promise).rejects.toThrow("video load error");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });

  it("should reject if extraction times out", async () => {
    jest.useFakeTimers();
    const file = createMockFile();
    
    const promise = extractVideoThumbnail(file, { timeoutMs: 100 });
    
    // Fast-forward time to trigger timeout
    jest.advanceTimersByTime(150);
    
    await expect(promise).rejects.toThrow("extraction timeout");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
    
    jest.useRealTimers();
  });

  it("should reject if AbortSignal is aborted", async () => {
    const controller = new AbortController();
    const file = createMockFile();
    
    const promise = extractVideoThumbnail(file, { signal: controller.signal });
    
    // Fire abort before video events
    controller.abort();
    
    await expect(promise).rejects.toThrow("AbortError");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });
});