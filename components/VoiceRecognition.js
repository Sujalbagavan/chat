import React from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";

const VoiceRecognition = () => {
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  if (!browserSupportsSpeechRecognition) {
    return <p>Your browser does not support speech recognition.</p>;
  }

  return (
    <div className="p-4 text-center">
      <h2 className="text-xl font-bold mb-2">AI Voice Recognition</h2>
      <p className="mb-4">Listening: {listening ? "🎙️ Yes" : "❌ No"}</p>
      
      <button onClick={SpeechRecognition.startListening} className="bg-blue-500 text-white px-4 py-2 rounded">
        Start Listening
      </button>
      <button onClick={SpeechRecognition.stopListening} className="bg-red-500 text-white px-4 py-2 rounded ml-2">
        Stop Listening
      </button>
      <button onClick={resetTranscript} className="bg-gray-500 text-white px-4 py-2 rounded ml-2">
        Reset
      </button>

      <p className="mt-4 text-lg">Transcript: {transcript}</p>
    </div>
  );
};

export default VoiceRecognition;
