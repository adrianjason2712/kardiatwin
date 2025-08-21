import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, User } from 'lucide-react';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface PulseChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

const PulseChatbot: React.FC<PulseChatbotProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: "Hello! I'm Pulse, your cardiac health assistant. How can I help you today?",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateBotResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();
    
    // Simple keyword-based responses (replace with LLM later)
    if (lowerMessage.includes('heart') || lowerMessage.includes('cardiac')) {
      return "I can help you understand your cardiac health! What specific questions do you have about your heart?";
    } else if (lowerMessage.includes('exercise') || lowerMessage.includes('workout')) {
      return "Exercise is great for heart health! Based on your profile, I'd recommend starting with moderate activities like walking or swimming. Always consult your doctor first.";
    } else if (lowerMessage.includes('symptoms') || lowerMessage.includes('pain')) {
      return "If you're experiencing chest pain or other concerning symptoms, please seek immediate medical attention. I'm here to help with general information, but I can't provide medical diagnosis.";
    } else if (lowerMessage.includes('blood pressure') || lowerMessage.includes('pressure')) {
      return "Blood pressure is a key indicator of heart health. Normal range is typically 120/80 mmHg. Regular monitoring and lifestyle changes can help maintain healthy levels.";
    } else if (lowerMessage.includes('cholesterol')) {
      return "Cholesterol levels are important for heart health. Aim for total cholesterol under 200 mg/dL. Diet, exercise, and sometimes medication can help manage levels.";
    } else if (lowerMessage.includes('risk') || lowerMessage.includes('assessment')) {
      return "I can help assess your cardiac risk factors based on age, gender, and symptoms. Would you like me to explain how different factors affect your heart health?";
    } else if (lowerMessage.includes('diet') || lowerMessage.includes('nutrition')) {
      return "A heart-healthy diet includes plenty of fruits, vegetables, whole grains, and lean proteins. Limit saturated fats, sodium, and added sugars.";
    } else if (lowerMessage.includes('stress') || lowerMessage.includes('anxiety')) {
      return "Stress can impact heart health. Techniques like deep breathing, meditation, and regular exercise can help manage stress levels.";
    } else if (lowerMessage.includes('medication') || lowerMessage.includes('drug')) {
      return "I can't provide specific medication advice. Please consult your healthcare provider about any medications or treatments.";
    } else if (lowerMessage.includes('family history') || lowerMessage.includes('genetic')) {
      return "Family history is an important risk factor for heart disease. Share this information with your doctor for personalized risk assessment.";
    } else {
      const responses = [
        "That's an interesting question! I'd be happy to help you learn more about cardiac health.",
        "I'm here to support your heart health journey. Could you tell me more about what you'd like to know?",
        "Great question! Let me help you understand how this relates to your cardiac health.",
        "I'm Pulse, your cardiac health companion. I can help explain heart health concepts and answer your questions.",
        "That's a good point! Understanding your heart health is important. What specific aspect would you like to explore?"
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Simulate typing delay
    setTimeout(() => {
      const botResponse = generateBotResponse(inputText);
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000); // Random delay between 1-2 seconds
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#8F87F1] to-[#C68EFD] p-4 rounded-t-xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5 text-[#8F87F1]" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Pulse</h3>
            <p className="text-white text-sm opacity-90">Cardiac Health Assistant</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.sender === 'user'
                  ? 'bg-[#8F87F1] text-white'
                  : 'bg-white text-gray-800 border border-gray-200'
              }`}
            >
              <p className="text-sm">{message.text}</p>
              <p className={`text-xs mt-1 ${
                message.sender === 'user' ? 'text-white opacity-70' : 'text-gray-500'
              }`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-800 border border-gray-200 p-3 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white rounded-b-xl">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Pulse about your heart health..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8F87F1] focus:border-transparent"
            disabled={isTyping}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isTyping}
            className="px-4 py-2 bg-[#8F87F1] text-white rounded-lg hover:bg-[#C68EFD] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Pulse is an AI assistant. For medical emergencies, call emergency services immediately.
        </p>
      </div>
    </div>
  );
};

export default PulseChatbot;
