import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, X, Trash2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import API from '../utils/axios';
import { useLocation } from 'react-router-dom';

interface ChatMessage {
  id: number;
  content: string;
  role: 'user' | 'model';
  timestamp: string;
}

interface PulseChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

const PulseChatbot: React.FC<PulseChatbotProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTimer, setRetryTimer] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper to extract session ID from URL (e.g., /analytics/164)
  const getActiveSessionId = useCallback(() => {
    const match = location.pathname.match(/\/analytics\/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }, [location.pathname]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // 1. Fetch Chat History on Open
  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 2. Cooldown Timer Logic
  useEffect(() => {
    let interval: any;
    if (retryTimer > 0) {
      interval = setInterval(() => {
        setRetryTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [retryTimer]);

  const fetchHistory = async () => {
    try {
      const response = await API.get('/api/chat/history');
      // Ensure history is sorted by timestamp correctly
      const sortedHistory = response.data.sort((a: any, b: any) => {
        const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.id - b.id; // Tie-breaker
      });
      setMessages(sortedHistory);
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isTyping || retryTimer > 0) return;

    const userMsgText = inputText;
    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      content: userMsgText,
      role: 'user',
      timestamp: new Date().toISOString()
    };

    // Optimistically update
    setMessages(prev => [...prev, tempUserMsg]);
    setInputText('');
    setIsTyping(true);
    setError(null);

    try {
      // Determine active context
      const currentSessionId = getActiveSessionId();
      
      const response = await API.post('/api/chat', { 
        message: userMsgText,
        session_id: currentSessionId 
      });
      
      // Server returns { response: string, history: ChatMessage[] }
      // Sort the returned history to prevent ordering bugs
      const newHistory = response.data.history.sort((a: any, b: any) => {
        const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.id - b.id; // Tie-breaker
      });
      setMessages(newHistory);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError('Quota exceeded for metric');
        setRetryTimer(60); // Start the 60s cooldown
      } else {
        setError('I am having trouble connecting to the clinical engine. Please try again.');
      }
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear your conversation history?')) return;
    
    try {
      await API.delete('/api/chat/history');
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear history', err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[550px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#8F87F1] to-[#C68EFD] p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold leading-tight">Pulse Advisor</h3>
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <p className="text-white text-xs opacity-90">
                {getActiveSessionId() 
                  ? `Grounded in Session #${getActiveSessionId()}` 
                  : 'Personalized Clinical Engine'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleClearHistory}
            className="text-white/70 hover:text-white transition-colors p-1"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Medical Warning Banner */}
      <div className="bg-amber-50 border-b border-amber-100 p-2 flex items-start space-x-2">
        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-[10px] text-amber-800 leading-tight">
          <strong>Medical Notice:</strong> Pulse uses AI simulation based on your history. 
          Information is for educational visualization only. In an emergency, dial 911.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.length === 0 && !isTyping && (
          <div className="text-center mt-20 px-6">
            <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Hello! I'm Pulse. Ask me about your simulation results, recovery patterns, or physiological markers.</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={`${message.id}-${index}`}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-2xl shadow-sm ${
                message.role === 'user'
                   ? 'bg-gradient-to-br from-[#8F87F1] to-[#7f75e8] text-white rounded-tr-none'
                  : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
              }`}
            >
              <div className="text-sm leading-relaxed prose prose-sm max-w-none">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
              <p className={`text-[10px] mt-1 text-right ${
                message.role === 'user' ? 'text-white/70' : 'text-gray-400'
              }`}>
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-800 border border-gray-200 p-4 rounded-2xl rounded-tl-none shadow-sm">
              <div className="flex space-x-1.5">
                <div className="w-1.5 h-1.5 bg-[#8F87F1] rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-[#8F87F1] rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                <div className="w-1.5 h-1.5 bg-[#8F87F1] rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
              </div>
            </div>
          </div>
        )}

        {retryTimer > 0 && (
          <div className="flex justify-center">
            <div className="bg-amber-50 text-amber-700 text-[11px] px-4 py-2 rounded-xl border border-amber-100 flex items-center space-x-2 shadow-sm animate-fade-in">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-ping"></span>
              <span>Clinical Advisor is resting. Please wait **{retryTimer}s**...</span>
            </div>
          </div>
        )}

        {error && !retryTimer && (
          <div className="flex justify-center">
            <div className="bg-red-50 text-red-600 text-[11px] px-3 py-1 rounded-full border border-red-100">
              {error}
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-100 bg-white">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={retryTimer > 0 ? `Resume in ${retryTimer}s...` : "Review my recovery..."}
            className="w-full pl-4 pr-12 py-3 bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-[#8F87F1]/50 text-sm transition-all"
            disabled={isTyping || retryTimer > 0}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isTyping || retryTimer > 0}
            className="absolute right-2 p-2 bg-[#8F87F1] text-white rounded-xl hover:bg-[#7f75e8] transition-all disabled:opacity-50 shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PulseChatbot;
