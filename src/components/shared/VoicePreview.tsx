"use client";

import { useRef, useState } from "react";
import { Play, Pause, Volume2 } from "lucide-react";

interface VoiceFile {
  gender: "Male" | "Female";
  name: string;
  file: string;
}

const VOICE_FILES: VoiceFile[] = [
  // Female voices
  { gender: "Female", name: "Aly", file: "/voices/Female - Aly.mp3" },
  { gender: "Female", name: "Hope – English (American Voice)", file: "/voices/Female - Hope English American Voice.mp4" },
  { gender: "Female", name: "Maya – English (American)", file: "/voices/Female - Maya English American.mp4" },
  { gender: "Female", name: "Melo – English", file: "/voices/Female - Melo English.mp4" },
  { gender: "Female", name: "Melo – Tagalog", file: "/voices/Female - Melo Tagalog.mp4" },
  // Male voices
  { gender: "Male", name: "Coco – English (Filipino Voice)", file: "/voices/Male - Coco Eng Fil Voice.mp4" },
  { gender: "Male", name: "Perry", file: "/voices/Male - Perry.mp4" },
  { gender: "Male", name: "Tomi", file: "/voices/Male - Tomi.mp4" },
];

interface VoicePreviewProps {
  selectedGender: string;
}

export function VoicePreview({ selectedGender }: VoicePreviewProps) {
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const voices = selectedGender
    ? VOICE_FILES.filter((v) => v.gender === selectedGender)
    : VOICE_FILES;

  const handlePlay = (file: string) => {
    // If already playing this file, pause it
    if (playingFile === file && audioRef.current) {
      audioRef.current.pause();
      setPlayingFile(null);
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(file);
    audioRef.current = audio;
    audio.play();
    setPlayingFile(file);

    audio.addEventListener("ended", () => {
      setPlayingFile(null);
    });

    audio.addEventListener("error", () => {
      setPlayingFile(null);
    });
  };

  if (!selectedGender) {
    return (
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <Volume2 className="h-5 w-5 text-purple-600" />
          <h3 className="text-base font-semibold text-gray-900">Voice Preview</h3>
        </div>
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-500">
            Select a <strong>Gender</strong> above to preview available AI voices.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <Volume2 className="h-5 w-5 text-purple-600" />
        <h3 className="text-base font-semibold text-gray-900">Voice Preview</h3>
        <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
          {selectedGender}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Listen to the available {selectedGender.toLowerCase()} AI voice samples below.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {voices.map((voice) => {
          const isPlaying = playingFile === voice.file;
          return (
            <button
              key={voice.file}
              type="button"
              onClick={() => handlePlay(voice.file)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-sm ${
                isPlaying
                  ? "border-purple-400 bg-purple-50 shadow-sm"
                  : "border-gray-200 bg-white hover:border-purple-200 hover:bg-purple-50/50"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  isPlaying
                    ? "bg-purple-600 text-white"
                    : "bg-purple-100 text-purple-600"
                }`}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 ml-0.5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {voice.name}
                </p>
                <p className="text-xs text-gray-500">
                  {voice.file.endsWith(".mp3") ? "MP3" : "MP4"} audio
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
