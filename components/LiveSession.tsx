
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveSession as GeminiLiveSession, LiveServerMessage, Modality } from '@google/genai';
import { Icon } from './Icon';
import { useAppContext } from '../context/AppContext';
import { createPcmBlob, decode, decodeAudioData } from '../utils/audio';
import type { SessionSummary } from '../types';

interface LiveSessionProps {
    onSessionEnd: (summary: SessionSummary) => void;
}

export const LiveSession: React.FC<LiveSessionProps> = ({ onSessionEnd }) => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isMicOn, setIsMicOn] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isScreenOn, setIsScreenOn] = useState(false);
    const [status, setStatus] = useState('Idle. Press Start to connect.');
    const [transcription, setTranscription] = useState<{user: string, model: string}[]>([]);
    const [currentSpokenText, setCurrentSpokenText] = useState<{user: string, model: string}>({user: '', model: ''});
    
    // Collaboration state
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isAnnotating, setIsAnnotating] = useState(false);

    const sessionPromiseRef = useRef<Promise<GeminiLiveSession> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
    const frameIntervalRef = useRef<number | null>(null);

    const { sharedImage, setSharedImage } = useAppContext();

    useEffect(() => {
        return () => { // Cleanup on unmount
            stopSession();
        };
    }, []);

    useEffect(() => {
        if (sharedImage && sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => {
                session.sendRealtimeInput({
                    media: { data: sharedImage.data, mimeType: sharedImage.mimeType }
                });
            });
            setSharedImage(null); // Consume the image
        }
    }, [sharedImage, setSharedImage]);

    // Canvas drawing logic
    useEffect(() => {
        if (isAnnotating && annotationCanvasRef.current) {
            const canvas = annotationCanvasRef.current;
            const video = videoRef.current;
            if (video) { 
                const resizeObserver = new ResizeObserver(() => {
                    canvas.width = video.clientWidth;
                    canvas.height = video.clientHeight;
                });
                resizeObserver.observe(video);
                canvas.width = video.clientWidth;
                canvas.height = video.clientHeight;
            }
            const context = canvas.getContext('2d');
            if (!context) return;
            context.strokeStyle = "#F63E52";
            context.lineWidth = 3;
            context.lineCap = "round";

            let isDrawing = false;
            let lastX = 0;
            let lastY = 0;

            const startDrawing = (e: MouseEvent) => {
                isDrawing = true;
                [lastX, lastY] = [e.offsetX, e.offsetY];
            };
            const draw = (e: MouseEvent) => {
                if (!isDrawing) return;
                context.beginPath();
                context.moveTo(lastX, lastY);
                context.lineTo(e.offsetX, e.offsetY);
                context.stroke();
                [lastX, lastY] = [e.offsetX, e.offsetY];
            };
            const stopDrawing = () => isDrawing = false;
            
            canvas.addEventListener('mousedown', startDrawing);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseup', stopDrawing);
            canvas.addEventListener('mouseout', stopDrawing);

            return () => {
                canvas.removeEventListener('mousedown', startDrawing);
                canvas.removeEventListener('mousemove', draw);
                canvas.removeEventListener('mouseup', stopDrawing);
                canvas.removeEventListener('mouseout', stopDrawing);
            };
        }
    }, [isAnnotating]);

    const clearAnnotations = () => {
        const canvas = annotationCanvasRef.current;
        if (canvas) {
            const context = canvas.getContext('2d');
            context?.clearRect(0, 0, canvas.width, canvas.height);
        }
    };
    
    const generateAndSaveSummary = async (fullTranscription: {user: string, model: string}[]) => {
        if (fullTranscription.length === 0 || !process.env.API_KEY) return;
        
        setStatus("Generating session summary...");
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const transcriptText = fullTranscription.map(t => `User: ${t.user}\nGemini: ${t.model}`).join('\n\n');
            const prompt = `Please summarize the key points, questions, and solutions from the following conversation transcript. Also provide a short, descriptive title for the session based on its content. Respond in a valid JSON format with "title" and "summary" keys.
            
            Transcript:
            ---
            ${transcriptText}
            ---
            `;
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            let result = { title: "Session Summary", summary: "Could not generate summary." };
            try {
                const cleanedText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanedText);
                result.title = parsed.title || result.title;
                result.summary = parsed.summary || response.text; 
            } catch (e) {
                console.error("JSON parsing for summary failed", e);
                result.summary = response.text;
            }

            const newSummary: SessionSummary = {
                id: new Date().toISOString(),
                title: result.title,
                content: result.summary,
                date: new Date().toLocaleString(),
            };
            onSessionEnd(newSummary);

        } catch (error) {
            console.error("Failed to generate summary:", error);
            const fallbackSummary: SessionSummary = {
                id: new Date().toISOString(),
                title: "Session Log (Summary Failed)",
                content: fullTranscription.map(t => `User: ${t.user}\nGemini: ${t.model}`).join('\n\n'),
                date: new Date().toLocaleString(),
            };
            onSessionEnd(fallbackSummary);
        }
    };
    
    const stopAllStreams = useCallback(() => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    const stopSession = useCallback(async () => {
        setIsSessionActive(false);
        setIsMicOn(false);
        setIsCameraOn(false);
        setIsScreenOn(false);
        setIsAnnotating(false);
        
        stopAllStreams();

        if (sessionPromiseRef.current) {
            try {
                const session = await sessionPromiseRef.current;
                session.close();
            } catch (e) { console.error("Error closing session:", e); }
            sessionPromiseRef.current = null;
        }

        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        const finalTranscription = [...transcription, ...(currentSpokenText.user || currentSpokenText.model ? [currentSpokenText] : [])];
        await generateAndSaveSummary(finalTranscription);
        setTranscription([]);
        setCurrentSpokenText({user: '', model: ''});
        setStatus('Session ended.');
    }, [stopAllStreams, transcription, currentSpokenText, onSessionEnd]);

    const startSession = async () => {
        if (!process.env.API_KEY) {
            setStatus("API Key not found.");
            return;
        }
        setStatus('Connecting...');
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let nextStartTime = 0;
        const outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        const sources = new Set<AudioBufferSourceNode>();

        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction: "You are a friendly, multilingual assistant. Respond to users in the language they speak, including English, Hindi, and Bengali.",
            },
            callbacks: {
                onopen: () => {
                    setIsSessionActive(true);
                    setStatus('Connected! Enable mic to start talking.');
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.outputTranscription) {
                        setCurrentSpokenText(prev => ({...prev, model: prev.model + message.serverContent!.outputTranscription!.text}));
                    }
                    if (message.serverContent?.inputTranscription) {
                        setCurrentSpokenText(prev => ({...prev, user: prev.user + message.serverContent!.inputTranscription!.text}));
                    }
                    if (message.serverContent?.turnComplete) {
                        setTranscription(prev => [...prev, currentSpokenText]);
                        setCurrentSpokenText({user: '', model: ''});
                    }

                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio) {
                        nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                        const source = outputAudioContext.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputAudioContext.destination);
                        source.addEventListener('ended', () => sources.delete(source));
                        source.start(nextStartTime);
                        nextStartTime = nextStartTime + audioBuffer.duration;
                        sources.add(source);
                    }
                    if (message.serverContent?.interrupted) {
                         for (const source of sources.values()) {
                            source.stop();
                            sources.delete(source);
                        }
                        nextStartTime = 0;
                    }
                },
                onclose: () => {
                    setStatus('Connection closed.');
                    if (isSessionActive) stopSession();
                },
                onerror: (e) => {
                    console.error('Session error:', e);
                    setStatus(`Error: ${e.type}`);
                    if (isSessionActive) stopSession();
                },
            }
        });
    };

    const toggleMicrophone = async () => {
        if (!isSessionActive) return;
        if (isMicOn) {
            if (scriptProcessorRef.current) {
                scriptProcessorRef.current.disconnect();
                scriptProcessorRef.current = null;
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
            setIsMicOn(false);
            setStatus('Microphone off.');
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
                const source = audioContextRef.current.createMediaStreamSource(stream);
                scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
                
                scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                    const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                    const pcmBlob = createPcmBlob(inputData);
                    sessionPromiseRef.current?.then((session) => {
                        session.sendRealtimeInput({ media: pcmBlob });
                    });
                };

                source.connect(scriptProcessorRef.current);
                scriptProcessorRef.current.connect(audioContextRef.current.destination);
                setIsMicOn(true);
                setStatus('Microphone on. Start speaking!');
            } catch (err) {
                console.error("Microphone access denied:", err);
                setStatus("Microphone access denied.");
            }
        }
    };

    const startMediaStream = async (type: 'camera' | 'screen') => {
        stopAllStreams();
        try {
            const constraints = type === 'camera' ? { video: true } : { video: { mediaSource: 'screen' } as any };
            const stream = type === 'camera' 
                ? await navigator.mediaDevices.getUserMedia(constraints)
                : await navigator.mediaDevices.getDisplayMedia(constraints);
            
            mediaStreamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            if (type === 'camera') setIsCameraOn(true);
            if (type === 'screen') setIsScreenOn(true);
            
            const canvas = canvasRef.current;
            const video = videoRef.current;
            if (!canvas || !video) return;

            frameIntervalRef.current = window.setInterval(() => {
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                canvas.toBlob((blob) => {
                    if (blob && sessionPromiseRef.current) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                           const base64Data = (reader.result as string).split(',')[1];
                           sessionPromiseRef.current?.then(session => {
                               session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
                           });
                        };
                        reader.readAsDataURL(blob);
                    }
                }, 'image/jpeg', 0.8);
            }, 500); // 2 FPS

        } catch (err) {
            console.error(`${type} access error:`, err);
            setStatus(`${type} access denied or failed.`);
        }
    };

    const toggleCamera = () => {
        if (!isSessionActive) return;
        if (isCameraOn) {
            stopAllStreams();
            setIsCameraOn(false);
        } else {
            if (isScreenOn) setIsScreenOn(false);
            startMediaStream('camera');
        }
    };

    const toggleScreenShare = () => {
        if (!isSessionActive) return;
        if (isScreenOn) {
            stopAllStreams();
            setIsScreenOn(false);
        } else {
            if (isCameraOn) setIsCameraOn(false);
            startMediaStream('screen');
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-800 rounded-lg p-6 shadow-xl">
            <h1 className="text-2xl font-bold mb-4">Live Session</h1>
            <div className={`text-sm mb-4 p-3 rounded-md ${
                isSessionActive ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
            }`}>
                Status: {status}
            </div>
            
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
                <div className="bg-gray-900 rounded-lg overflow-hidden relative flex items-center justify-center">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain"></video>
                    {isAnnotating && <canvas ref={annotationCanvasRef} className="absolute top-0 left-0 w-full h-full" />}
                    {!isCameraOn && !isScreenOn && (
                        <div className="absolute text-center text-gray-500">
                           <Icon icon="video-off" className="h-16 w-16 mx-auto mb-2" />
                           <p>Camera and screen share are off</p>
                        </div>
                    )}
                    <canvas ref={canvasRef} className="hidden"></canvas>
                </div>
                
                <div className="bg-gray-900 rounded-lg p-4 flex flex-col min-h-0">
                    <h2 className="text-lg font-semibold mb-2 border-b border-gray-700 pb-2">Live Transcription</h2>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                        {transcription.map((t, i) => (
                           <div key={i}>
                               <p><strong className="text-blue-400">You:</strong> {t.user}</p>
                               <p><strong className="text-purple-400">Gemini:</strong> {t.model}</p>
                           </div>
                        ))}
                         <div>
                            {currentSpokenText.user && <p><strong className="text-blue-400">You:</strong> {currentSpokenText.user}</p>}
                            {currentSpokenText.model && <p><strong className="text-purple-400">Gemini:</strong> {currentSpokenText.model}</p>}
                         </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700 flex items-center justify-center gap-2 md:gap-4">
                {!isSessionActive ? (
                    <button onClick={startSession} className="px-6 py-3 bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2">
                        <Icon icon="play" className="h-5 w-5" /> Start Session
                    </button>
                ) : (
                    <>
                       <button onClick={toggleMicrophone} title="Toggle Microphone" className={`p-3 rounded-full transition ${isMicOn ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'}`}>
                           <Icon icon={isMicOn ? 'mic-off' : 'mic'} className="h-6 w-6" />
                       </button>
                       <button onClick={toggleCamera} title="Toggle Camera" className={`p-3 rounded-full transition ${isCameraOn ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'}`}>
                           <Icon icon={isCameraOn ? 'video-off' : 'video'} className="h-6 w-6" />
                       </button>
                       <button onClick={toggleScreenShare} title="Share Screen" className={`p-3 rounded-full transition ${isScreenOn ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'}`}>
                           <Icon icon="screen" className="h-6 w-6" />
                       </button>
                       <button onClick={() => setIsAnnotating(!isAnnotating)} title="Annotate" className={`p-3 rounded-full transition ${isAnnotating ? 'bg-purple-600' : 'bg-gray-600 hover:bg-gray-500'}`}>
                           <Icon icon="annotate" className="h-6 w-6" />
                       </button>
                       {isAnnotating && <button onClick={clearAnnotations} className="px-3 py-2 text-xs bg-gray-600 rounded-md hover:bg-gray-500">Clear</button>}
                       <button onClick={() => setIsInviteModalOpen(true)} title="Invite Users" className="p-3 rounded-full transition bg-gray-600 hover:bg-gray-500">
                           <Icon icon="invite" className="h-6 w-6" />
                       </button>
                       <button onClick={stopSession} className="px-5 py-3 bg-red-600 rounded-lg font-semibold hover:bg-red-700 transition flex items-center gap-2">
                           <Icon icon="stop" className="h-5 w-5" /> Stop
                       </button>
                    </>
                )}
            </div>
            {isInviteModalOpen && (
                 <div className="fixed inset-0 bg-black/60 flex items-center justify-center" onClick={() => setIsInviteModalOpen(false)}>
                    <div className="bg-gray-700 rounded-lg p-8 shadow-xl max-w-sm text-center" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4">Invite Others (Mock)</h3>
                        <p className="text-gray-300 mb-4">This is a conceptual feature. In a full application, you would share this link to invite others to join your session.</p>
                        <input type="text" readOnly value="https://yourapp.com/session/12345" className="w-full bg-gray-800 p-2 rounded border border-gray-600 text-center" />
                        <button onClick={() => setIsInviteModalOpen(false)} className="mt-6 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700">Close</button>
                    </div>
                 </div>
            )}
        </div>
    );
};
