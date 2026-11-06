import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_KEY, applyTheme, storedTheme } from "~/lib/theme";
import { computePeaks as decodePeaks, probeDuration } from "~/lib/waveform-client";

// Browser-only helpers, run against stand-ins for the browser APIs they call (localStorage,
// matchMedia, AudioContext), so what they do with each answer is pinned without a browser.
afterEach(() => vi.unstubAllGlobals());

function storage(initial: Record<string, string> = {}, throws = false) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => {
      if (throws) throw new Error("denied");
      return k in data ? data[k] : null;
    },
    setItem: (k: string, v: string) => {
      if (throws) throw new Error("denied");
      data[k] = v;
    },
  };
}

describe("theme", () => {
  it("reads a stored choice only if it is light or dark, and nothing when storage is missing", () => {
    expect(storedTheme()).toBeNull();
    vi.stubGlobal("localStorage", storage({ [THEME_KEY]: "light" }));
    expect(storedTheme()).toBe("light");
    vi.stubGlobal("localStorage", storage({ [THEME_KEY]: "dark" }));
    expect(storedTheme()).toBe("dark");
    vi.stubGlobal("localStorage", storage({ [THEME_KEY]: "sepia" }));
    expect(storedTheme()).toBeNull();
    vi.stubGlobal("localStorage", storage());
    expect(storedTheme()).toBeNull();
  });

  it("sets data-theme on the page and remembers it, and still sets it when storage is blocked", () => {
    const attrs: Record<string, string> = {};
    vi.stubGlobal("document", { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } });
    const store = storage();
    vi.stubGlobal("localStorage", store);
    applyTheme("light");
    expect(attrs["data-theme"]).toBe("light");
    expect(store.data[THEME_KEY]).toBe("light");
    vi.stubGlobal("localStorage", storage({}, true));
    expect(() => applyTheme("dark")).not.toThrow();
    expect(attrs["data-theme"]).toBe("dark");
  });
});

describe("waveform-client", () => {
  const closed = vi.fn();
  function audioContext(decode: (b: ArrayBuffer) => unknown) {
    return class {
      decodeAudioData = async (b: ArrayBuffer) => decode(b);
      close = closed;
    };
  }
  const buffer = (channels: number[][], duration = 12.5) => ({ numberOfChannels: channels.length, duration, getChannelData: (i: number) => Float32Array.from(channels[i]) });
  beforeEach(() => closed.mockClear());

  it("decodes in the browser, buckets the channels into the stored peaks, and reports the duration", async () => {
    let seen: ArrayBuffer | undefined;
    vi.stubGlobal("AudioContext", audioContext((b) => ((seen = b), buffer([new Array(800).fill(0.5), new Array(800).fill(0.5)]))));
    const source = new Uint8Array([1, 2, 3]).buffer;
    const out = await decodePeaks(source);
    expect(out!.duration).toBe(12.5);
    expect(out!.peaks).toHaveLength(400);
    expect(out!.peaks.every((p) => p === 100)).toBe(true);
    expect(seen).not.toBe(source);
    expect(new Uint8Array(seen!)).toEqual(new Uint8Array([1, 2, 3]));
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("hears the second channel of a stereo file even when the first is silent", async () => {
    vi.stubGlobal("AudioContext", audioContext(() => buffer([new Array(400).fill(0), new Array(400).fill(0.8)])));
    expect((await decodePeaks(new ArrayBuffer(1)))!.peaks.every((p) => p === 100)).toBe(true);
  });

  it("answers null, and still closes the context, when the audio cannot be decoded", async () => {
    vi.stubGlobal("AudioContext", audioContext(() => Promise.reject(new Error("bad audio"))));
    expect(await decodePeaks(new ArrayBuffer(1))).toBeNull();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  describe("probeDuration", () => {
    const revoke = vi.fn();
    function probe(fire: (audio: { onloadedmetadata?: () => void; onerror?: () => void; duration?: number; src?: string; preload?: string }) => void) {
      const audio: Record<string, any> = {};
      vi.stubGlobal("document", { createElement: (tag: string) => (tag === "audio" ? audio : {}) });
      URL.createObjectURL = () => "blob:fake";
      URL.revokeObjectURL = revoke;
      const result = probeDuration(new File([new Uint8Array(1)], "a.mp3", { type: "audio/mpeg" }));
      fire(audio);
      return { audio, result };
    }
    beforeEach(() => revoke.mockClear());

    it("reads only the metadata, whole seconds, and frees the temporary URL", async () => {
      const { audio, result } = probe((a) => {
        a.duration = 61.9;
        a.onloadedmetadata!();
      });
      expect(await result).toBe(61);
      expect(audio.preload).toBe("metadata");
      expect(audio.src).toBe("blob:fake");
      expect(revoke).toHaveBeenCalledWith("blob:fake");
    });

    it("answers null for a duration that is not a number, and for a file that will not load", async () => {
      expect(await probe((a) => { a.duration = Infinity; a.onloadedmetadata!(); }).result).toBeNull();
      expect(await probe((a) => { a.duration = NaN; a.onloadedmetadata!(); }).result).toBeNull();
      expect(await probe((a) => a.onerror!()).result).toBeNull();
    });
  });
});
