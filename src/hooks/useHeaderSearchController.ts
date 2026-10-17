import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { searchProductsByImage } from "@/services/api/imageSearch";
import { saveRecentSearch } from "@/hooks/useGlobalSearch";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

const VOICE_LANGS: Record<string, string> = {
  es: "es-ES",
  en: "en-US",
  fr: "fr-FR",
  ht: "fr-HT",
};

interface HeaderSearchControllerOptions {
  /** Override the default submit behavior (navigate to /busqueda). */
  onSubmit?: (term: string) => void;
  /** Where to navigate with image search results. Defaults to /busqueda?source=image. */
  imageSearchPath?: string;
}

/**
 * Shared search controller for all headers (desktop + mobile):
 * text submit (saves recent searches), voice search in the UI language,
 * and image search. All navigate to /busqueda unless overridden.
 */
export const useHeaderSearchController = (options: HeaderSearchControllerOptions = {}) => {
  const { onSubmit, imageSearchPath = "/busqueda?source=image" } = options;
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isImageSearching, setIsImageSearching] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const API = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!API);
  }, []);

  // Abort any active recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const submitSearch = useCallback(
    (raw?: string) => {
      const term = (raw ?? searchQuery).trim();
      if (!term) return;
      saveRecentSearch(term);
      if (onSubmit) onSubmit(term);
      else navigate(`/busqueda?q=${encodeURIComponent(term)}`);
    },
    [searchQuery, navigate, onSubmit]
  );

  const startVoiceSearch = useCallback(() => {
    const API = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!API) {
      toast.error(t("header.voiceNotSupported"));
      return;
    }
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new API();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = VOICE_LANGS[i18n.language?.substring(0, 2) || "es"] || "es-ES";

    recognition.onstart = () => {
      setIsListening(true);
      toast.info(t("header.listening"), { duration: 2000 });
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += transcript;
        else interimTranscript += transcript;
      }
      if (interimTranscript) setSearchQuery(interimTranscript);
      if (finalTranscript) {
        setSearchQuery(finalTranscript);
        toast.success(t("header.searching", { query: finalTranscript }));
        saveRecentSearch(finalTranscript.trim());
        if (onSubmit) onSubmit(finalTranscript.trim());
        else navigate(`/busqueda?q=${encodeURIComponent(finalTranscript.trim())}`);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === "no-speech") toast.error(t("header.noSpeech"));
      else if (event.error === "audio-capture") toast.error(t("header.noMicrophone"));
      else if (event.error === "not-allowed") toast.error(t("header.micDenied"));
      else toast.error(t("header.voiceError"));
    };

    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, i18n.language, navigate, onSubmit, t]);

  const handleImageSearch = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsImageSearching(true);
      toast.info(t("header.loadingAI"));
      try {
        const results = await searchProductsByImage(file);
        if (results && results.length > 0) {
          sessionStorage.setItem("imageSearchResults", JSON.stringify(results));
          navigate(imageSearchPath);
          toast.success(t("header.similarFound", { count: results.length }));
        } else {
          toast.info(t("header.noSimilarFound"));
        }
      } catch (error) {
        console.error("Image search error:", error);
        toast.error(t("header.imageSearchError"));
      } finally {
        setIsImageSearching(false);
        if (imageInputRef.current) imageInputRef.current.value = "";
      }
    },
    [navigate, imageSearchPath, t]
  );

  const clearSearch = useCallback(() => setSearchQuery(""), []);

  return {
    searchQuery,
    setSearchQuery,
    submitSearch,
    clearSearch,
    startVoiceSearch,
    isListening,
    voiceSupported,
    handleImageSearch,
    isImageSearching,
    imageInputRef,
  };
};
