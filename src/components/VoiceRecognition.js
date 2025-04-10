import React, { useState, useEffect, useRef } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import axios from "axios";
import { useSpeechSynthesis } from "react-speech-kit";

const cleanResponse = (response) => {
  // First handle any content within <think> tags
  response = response.replace(/<think>[\s\S]*?<\/think>/g, "");
  
  // Handle additional potential thinking indicators
  response = response
    .replace(/\[.*?\]/g, "")          // Remove content in square brackets
    .replace(/\{.*?\}/g, "")          // Remove content in curly braces
    .replace(/<.*?thinking.*?>[\s\S]*?<\/.*?>/g, "") // Remove any other thinking tags
    .replace(/\bthinking:.*?(?=\n|$)/gi, "")  // Remove lines starting with "thinking:"
    .replace(/\binternal:.*?(?=\n|$)/gi, "")  // Remove lines starting with "internal:"
    .replace(/\breasoning:.*?(?=\n|$)/gi, "") // Remove lines starting with "reasoning:"
    .replace(/\*\*(.*?)\*\*/g, "$1")   // Remove markdown bold
    .replace(/`(.*?)`/g, "$1")         // Remove code ticks
    .replace(/[*#\$@_~]/g, "")         // Remove other markdown characters
    .replace(/\n\s*\n/g, "\n")         // Remove extra line breaks
    .trim();                           // Clean up whitespace
    
  return response;
};

const VoiceAssistant = () => {
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();
  const { speak, speaking, cancel, voices } = useSpeechSynthesis();
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversation, setConversation] = useState([]);
  const [autoMode, setAutoMode] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const [status, setStatus] = useState("idle");
  const [inputText, setInputText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(null);
  const previousTranscript = useRef("");
  const conversationEndRef = useRef(null);
  const textInputRef = useRef(null);

  // Strong instructions for the life decision advisor
  const systemInstruction = `
 {
Instructions for Rivoo – The AI Decision-Making Bot
🧠 Purpose:
Rivoo is an AI-powered decision-making assistant designed to reduce decision fatigue by giving clear and actionable verdicts in seconds.

📝 How Rivoo Responds:
💬 Step 1: Start the Conversation


🔹 If the query is complete:

Output: A one-word decision + a short 60-word explanation.
🔹 If the query is incomplete:

Output: A request for more details in straight points.

After the user replies with the missing details, Rivoo provides the one-word verdict + 60-word explanation.
🔹 Memory Feature:

Rivoo remembers past conversations like ChatGPT, allowing users to make follow-up decisions without re-explaining their context.

📌 Response Examples:
✅ Complete Query Example:
💬 "Shall I go take some rest or complete my app's subscription gateway settings? I need the app sent for testing ASAP, but I'm tired after driving for 3 hours. What should I do?"
🔹 Rivoo's Response:
Decision: Rest.
Explanation: You’re exhausted, and mental clarity is crucial for important tasks. Rest now so you can work efficiently later. Rushing while tired may lead to mistakes, delaying the process even more. Take a short break, recharge, and then tackle the task with a fresh mind.

✅ Incomplete Query Example:
💬 "Should I increase my startup’s subscription price?"
🔹 Rivoo's Response:
"Please provide more details:

Current price?

Churn rate?

User demand & revenue goal?
I'll give the best one-word verdict."

✅ After Receiving More Details:
💬 "My current price is $10/week, churn is 5%, and I want to maximize profits."
🔹 Rivoo's Response:
Decision: Increase.
Explanation: With a low churn rate and strong demand, increasing the price will likely boost revenue without losing too many subscribers. Test a small price hike first to measure user response, then adjust as needed. Higher pricing also increases perceived value, attracting premium customers.

✅ Follow-Up Example (Using Memory):
💬 "Rivoo, I took your advice and increased my price to $12/week. Churn is now at 6%. Should I keep it or lower it?"
🔹 Rivoo's Response:
Decision: Keep.
Explanation: A slight increase in churn is expected, but if overall revenue is higher, it's worth keeping the new price. Monitor customer feedback and retention for a few more weeks before making further changes.

🔑 Key Features of Rivoo:
✅ Starts every chat with: "How can I help you with your decision today?"
✅ If the query is incomplete, asks for missing details in bullet points.
✅ Remembers previous conversations for context.
✅ After receiving details, provides a one-word verdict + 60-word explanation.
✅ Never reveals internal reasoning.
✅ Never overwhelms users with excessive details.
✅ Keeps responses friendly, human-like, and practical.

This ensures Rivoo delivers fast, stress-free, and highly effective decision-making assistance!
}
  `;

  useEffect(() => {
    if (voices && voices.length > 0 && !selectedVoice) {
      const preferredVoice = voices.find(voice => 
        voice.name.includes("Google") || 
        voice.name.includes("Samantha") || 
        voice.name.includes("Daniel")
      ) || voices[0];
      setSelectedVoice(preferredVoice);
    }
  }, [voices, selectedVoice]);

  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversation]);

  useEffect(() => {
    if (!listening && !speaking && transcript && transcript !== previousTranscript.current && autoMode) {
      previousTranscript.current = transcript;
      SpeechRecognition.stopListening();
      fetchAIResponse(transcript);
    }
  }, [transcript, listening, speaking, autoMode]);

  if (!browserSupportsSpeechRecognition) {
    return <div className="error-message">Your browser does not support speech recognition.</div>;
  }

  const fetchAIResponse = async (text) => {
    if (!text) return;
    setIsLoading(true);
    setError("");
    setStatus("processing");

    setConversation(prev => [...prev, { role: "user", content: text }]);

    try {
      const res = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "deepseek-r1-distill-qwen-32b",
          messages: [
            { role: "system", content: systemInstruction },
            ...conversation.map(msg => ({
              role: msg.role === "user" ? "user" : "assistant",
              content: msg.content
            })),
            { role: "user", content: text }
          ],
          temperature: 0.7,
          max_tokens: 500,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.REACT_APP_GROQ_API_KEY}`,
          },
        }
      );

      const aiText = res.data.choices[0].message.content;
      
      // For debugging
      console.log("Raw API response:", aiText);
      
      const cleanedText = cleanResponse(aiText);
      console.log("After cleaning:", cleanedText);
      
      // Additional check to make sure nothing slips through
      const finalText = cleanedText.includes("think") || 
                        cleanedText.includes("reasoning") || 
                        cleanedText.includes("internal") ? 
                        cleanedText.split(/\n/).filter(line => 
                          !line.toLowerCase().includes("think") && 
                          !line.toLowerCase().includes("reasoning") &&
                          !line.toLowerCase().includes("internal")
                        ).join("\n") : 
                        cleanedText;
      
      setResponse(finalText);
      
      setConversation(prev => {
        const newConv = [...prev];
        if (newConv[newConv.length - 1].role === "user") {
          return [...newConv, { role: "assistant", content: finalText }];
        }
        return [...prev, { role: "assistant", content: finalText }];
      });
      
      setStatus("speaking");
      if (voiceMode) {
        speak({
          text: finalText,
          voice: selectedVoice,
          onEnd: () => {
            if (autoMode) {
              setTimeout(() => {
                setStatus("listening");
                SpeechRecognition.startListening({ continuous: true });
              }, 1000);
            } else {
              setStatus("idle");
            }
          },
        });
      } else {
        setStatus("idle");
      }
    } catch (error) {
      console.error("Error fetching AI response:", error);
      setError(error.response?.data?.error?.message || "An error occurred while processing your request.");
      setStatus("idle");
    } finally {
      setIsLoading(false);
      resetTranscript();
    }
  };

  const handleTextSubmit = (e) => {
    e?.preventDefault();
    if (inputText.trim()) {
      fetchAIResponse(inputText.trim());
      setInputText("");
    }
  };

  const handleStartListening = () => {
    if (speaking) {
      cancel();
    }
    setStatus("listening");
    SpeechRecognition.startListening({ continuous: true });
  };

  const handleStopListening = () => {
    SpeechRecognition.stopListening();
    if (transcript && transcript !== previousTranscript.current) {
      previousTranscript.current = transcript;
      fetchAIResponse(transcript);
    } else {
      setStatus("idle");
    }
  };

  const handleStopSpeaking = () => {
    cancel();
    setStatus("idle");
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  const getStatusIcon = () => {
    if (isLoading) return <div className="status-indicator loading"></div>;
    if (speaking) return <div className="status-indicator speaking"></div>;
    if (listening) return <div className="status-indicator listening"></div>;
    return null;
  };

  return (
    <div className="voice-assistant">
      <div className="assistant-header">
        <div className="assistant-logo">
          <span className="logo-icon">R</span>
          <h1>Life Decision Advisor</h1>
        </div>
        <p className="assistant-tagline">Gain clarity on life's tough choices with thoughtful guidance</p>
        
        <div className="assistant-controls">
          <button 
            className={`control-button ${autoMode ? "active" : ""}`} 
            onClick={() => setAutoMode(!autoMode)}
            title={autoMode ? "Disable continuous conversation" : "Enable continuous conversation"}
          >
            <span className="control-icon">A</span>
            {autoMode ? "Auto Mode On" : "Auto Mode Off"}
          </button>
          
          <button 
            className={`control-button ${voiceMode ? "active" : ""}`} 
            onClick={() => setVoiceMode(!voiceMode)}
            title={voiceMode ? "Disable voice responses" : "Enable voice responses"}
          >
            <span className="control-icon">{voiceMode ? "🔊" : "🔇"}</span>
            {voiceMode ? "Voice On" : "Voice Off"}
          </button>

          {selectedVoice && voices.length > 1 && (
            <select 
              value={selectedVoice.name} 
              onChange={(e) => setSelectedVoice(voices.find(v => v.name === e.target.value))}
              className="voice-selector"
            >
              {voices.map(voice => (
                <option key={voice.name} value={voice.name}>
                  {voice.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="conversation-display">
        {conversation.length > 0 ? (
          <div className="messages-container">
            {conversation.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <div className="message-avatar">
                  {message.role === "user" ? "You" : "R"}
                </div>
                <div className="message-bubble">
                  <p>{message.content}</p>
                </div>
              </div>
            ))}
            <div ref={conversationEndRef} />
          </div>
        ) : (
          <div className="empty-conversation">
            <div className="empty-state-icon">💭</div>
            <h3>Welcome to RIVOO Life Decision Advisor</h3>
            <p>I'm here to help you navigate life's tough choices with clarity and confidence.</p>
            <div className="decision-examples">
              <p>You might ask about:</p>
              <ul className="quick-tips">
                <li>"Should I change careers?"</li>
                <li>"How do I know if this relationship is right?"</li>
                <li>"I'm torn between two big life paths - how to decide?"</li>
                <li>"Is now the right time to start my own business?"</li>
                <li>"How can I make better decisions about my health?"</li>
              </ul>
            </div>
            <p>Use voice or text to share your situation and I'll help you think it through.</p>
          </div>
        )}
        
        {status !== "idle" && (
          <div className="status-bar">
            {getStatusIcon()}
            <span>{status === "processing" ? "Thinking..." : status === "speaking" ? "Speaking..." : "Listening..."}</span>
            {status === "speaking" && voiceMode && (
              <button className="status-action" onClick={handleStopSpeaking}>
                <span className="action-icon">⏹️</span> Stop
              </button>
            )}
            {status === "listening" && (
              <button className="status-action" onClick={handleStopListening}>
                <span className="action-icon">⏹️</span> Stop & Send
              </button>
            )}
          </div>
        )}
      </div>

      <div className="input-section">
        <form onSubmit={handleTextSubmit} className="input-form">
          <div className="input-container">
            <textarea
              ref={textInputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe your situation or decision you're facing..."
              rows={1}
              disabled={isLoading || speaking}
            />
            
            <div className="input-actions">
              <button 
                type="submit" 
                className="send-button" 
                disabled={isLoading || speaking || !inputText.trim()}
              >
                Send
              </button>
              
              <button
                type="button"
                className={`voice-button ${listening ? "active" : ""}`}
                onClick={listening ? handleStopListening : handleStartListening}
                disabled={isLoading || speaking}
              >
                {listening ? "Stop" : "🎤"}
              </button>
            </div>
          </div>
        </form>

        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
};

export default VoiceAssistant;