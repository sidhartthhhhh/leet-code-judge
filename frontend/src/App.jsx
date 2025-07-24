import { initializeApp } from 'firebase/app';
import {
    getAuth,
    GithubAuthProvider,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';

// Import CodeMirror libraries
import { defaultKeymap } from '@codemirror/commands';
import { cpp } from '@codemirror/lang-cpp';
import { java as javaLang } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap } from '@codemirror/view';


// --- Configuration ---
const API_BASE_URL = "http://127.0.0.1:5000";

// --- Firebase Configuration ---
const firebaseConfig = {
                apiKey: "AIzaSyC2xvZp6DQ1_7biimiDWTS-YKNP2YPp5zU",
                authDomain: "leet-code-judge.firebaseapp.com",
                projectId: "leet-code-judge",
                storageBucket: "leet-code-judge.firebasestorage.app",
                messagingSenderId: "962095791695",
                appId: "1:962095791695:web:adfd42bd9cc9e54060f43a",
                measurementId: "G-VT84K8CE39"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Initialize Firestore

// --- Mock Data ---
const mockProblems = [
    // ... A large array of problem objects ...
    // For brevity, only showing one problem object here.
    // The full list from the previous version is included in the actual component.
    {
        id: 1,
        title: "Two Sum",
        difficulty: "Easy",
        description: `<p class="mb-4">Given an array of integers <code>nums</code> and an integer <code>target</code>, return indices of the two numbers such that they add up to <code>target</code>.</p><p>You may assume that each input would have <strong>exactly one solution</strong>, and you may not use the <em>same</em> element twice.</p><p>You can return the answer in any order.</p>`,
        examples: [
            { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].' },
            { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
        ],
        constraints: [
            '<code>2 <= nums.length <= 10<sup>4</sup></code>',
            '<code>-10<sup>9</sup> <= nums[i] <= 10<sup>9</sup></code>',
            '<code>-10<sup>9</sup> <= target <= 10<sup>9</sup></code>',
            '<strong>Only one valid answer exists.</strong>'
        ],
        hints: ['Use a hash map to store the numbers you have seen and their indices.'],
        boilerplate: {
            python: `class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        # Your code here\n        pass`,
            javascript: `/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar twoSum = function(nums, target) {\n    \n};`,
            java: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        \n    }\n}`,
            cpp: `class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        \n    }\n};`
        }
    },
].concat([...Array(49)].map((_, i) => ({ id: 1000 + i, title: `Placeholder Problem ${i + 2}`, difficulty: ["Easy", "Medium", "Hard"][i % 3], description: `<p>This is a placeholder description for problem ${i + 2}.</p>`, examples: [], constraints: [], boilerplate: { python: `# Placeholder for problem ${i + 2}` } })));
        
const CodeEditor = ({ language, boilerplate, onCodeChange }) => {
    const editorRef = useRef(null);
    const viewRef = useRef(null);

    useEffect(() => {
        if (!editorRef.current) return;

        const languageExtensions = {
            python: python(),
            javascript: javascript(),
            java: javaLang(),
            cpp: cpp(),
        };

        const onUpdate = EditorView.updateListener.of(update => {
            if (update.docChanged) {
                onCodeChange(update.state.doc.toString());
            }
        });
        
        if (viewRef.current) {
            viewRef.current.destroy();
        }

        const startState = EditorState.create({
            doc: boilerplate,
            extensions: [
                keymap.of(defaultKeymap),
                languageExtensions[language],
                oneDark,
                EditorView.lineWrapping,
                onUpdate
            ],
        });
        viewRef.current = new EditorView({ state: startState, parent: editorRef.current });

        return () => {
            if (viewRef.current) {
                viewRef.current.destroy();
            }
        }

    }, [language]); 

    useEffect(() => {
        if (viewRef.current && boilerplate !== viewRef.current.state.doc.toString()) {
            viewRef.current.dispatch({
                changes: { from: 0, to: viewRef.current.state.doc.length, insert: boilerplate || '' }
            });
        }
    }, [boilerplate]);

    return <div ref={editorRef} className="h-full w-full bg-[#2d2d2d]"></div>;
};

const ProblemDescription = ({ problem }) => {
     if (!problem) return null;
    const difficultyColor = { 'Easy': 'text-green-500', 'Medium': 'text-yellow-500', 'Hard': 'text-red-500' };
    return (
        <div className="p-6 h-full overflow-y-auto text-gray-300">
            <h1 className="text-xl font-medium text-gray-100 mb-4">{problem.id}. {problem.title}</h1>
            <p className={`font-medium text-sm ${difficultyColor[problem.difficulty]}`}>{problem.difficulty}</p>
            <hr className="my-4 border-gray-600" />
            
            <div className="prose prose-invert max-w-none text-gray-300" dangerouslySetInnerHTML={{ __html: problem.description }} />
            
            {problem.examples && problem.examples.length > 0 && (
                <div className="mt-6 space-y-4">
                    {problem.examples.map((ex, index) => (
                        <div key={index}>
                            <p className="font-medium text-gray-300">Example {index + 1}:</p>
                            <pre className="bg-gray-900/50 p-3 rounded-md text-sm mt-2 whitespace-pre-wrap">
                                <strong className="text-gray-400">Input:</strong> {ex.input}<br />
                                <strong className="text-gray-400">Output:</strong> {ex.output}
                                {ex.explanation && <><br /><strong className="text-gray-400">Explanation:</strong> {ex.explanation}</>}
                            </pre>
                        </div>
                    ))}
                </div>
            )}

            {problem.constraints && problem.constraints.length > 0 && (
                <div className="mt-6">
                    <h3 className="font-semibold mb-2 text-gray-200">Constraints:</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-400">
                        {problem.constraints.map((c, index) => <li key={index} dangerouslySetInnerHTML={{ __html: c }} />)}
                    </ul>
                </div>
            )}
             {problem.hints && problem.hints.length > 0 && (
                 <div className="mt-6">
                    <h3 className="font-semibold mb-2 text-gray-200">Hints:</h3>
                     <ul className="list-disc list-inside space-y-1 text-sm text-gray-400">
                        {problem.hints.map((h, index) => <li key={index}>{h}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
};

const ProblemListModal = ({ problems, onSelectProblem, onClose }) => {
    const difficultyColor = { 'Easy': 'text-green-400', 'Medium': 'text-yellow-400', 'Hard': 'text-red-400' };
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl h-full max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">Problems</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
                </div>
                <div className="overflow-y-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-700/50 sticky top-0">
                            <tr>
                                <th scope="col" className="px-6 py-3">Title</th>
                                <th scope="col" className="px-6 py-3">Difficulty</th>
                            </tr>
                        </thead>
                        <tbody>
                            {problems.map(p => (
                                <tr key={p.id} onClick={() => onSelectProblem(p)} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700 cursor-pointer">
                                    <td className="px-6 py-4 font-medium text-gray-200 whitespace-nowrap">{p.id}. {p.title}</td>
                                    <td className={`px-6 py-4 ${difficultyColor[p.difficulty]}`}>{p.difficulty}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const ResultPanel = ({ result, runResult, onCustomInputChange, customInput }) => {
    const [activeTab, setActiveTab] = useState('testcase');

    useEffect(() => {
        if (result || runResult) {
            setActiveTab('result');
        } else {
            setActiveTab('testcase');
        }
    }, [result, runResult]);

    const getStatusPill = (status) => {
        switch (status) {
            case 'PENDING':
            case 'Running':
                return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-400 text-yellow-900 animate-pulse">{status}...</span>;
            case 'Accepted':
                return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-400 text-green-900">Accepted</span>;
            case 'Timeout':
                 return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-orange-400 text-orange-900">Timeout</span>;
            default:
                return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-red-400 text-red-900">{status || 'Error'}</span>;
        }
    };
    
    return (
        <div className="bg-gray-800 text-gray-300 rounded-b-lg">
            <div className="flex border-b border-gray-700">
                <button 
                    onClick={() => setActiveTab('testcase')}
                    className={`px-4 py-2 text-sm font-medium ${activeTab === 'testcase' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>
                    Testcase
                </button>
                <button 
                    onClick={() => setActiveTab('result')}
                    className={`px-4 py-2 text-sm font-medium ${activeTab === 'result' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>
                    Test Result
                </button>
            </div>
            <div className="p-4 min-h-[120px]">
                {activeTab === 'testcase' && (
                    <div>
                        <label className="text-xs font-semibold" htmlFor="testcase-input">Input</label>
                        <textarea id="testcase-input" className="w-full mt-1 p-2 bg-gray-900 border border-gray-600 rounded-md text-sm font-mono" rows="3" value={customInput} onChange={onCustomInputChange}></textarea>
                    </div>
                )}
                {activeTab === 'result' && (
                    !result && !runResult ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-gray-500">Run or submit your code to see the result.</p>
                        </div>
                    ) : (
                        result ? (
                             <div>
                                <div className="flex items-center gap-4 mb-4">
                                    {getStatusPill(result.status)}
                                </div>
                                {result.status !== 'PENDING' && result.status !== 'Running' && result.result && (
                                    <div className="space-y-2 text-sm">
                                        <p><strong>Runtime:</strong> <span className="font-mono">{result.result.runtime_ms} ms</span></p>
                                        <p><strong>Memory:</strong> <span className="font-mono">{result.result.memory_kb} KB</span></p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <h3 className="text-sm font-semibold mb-2">Custom Run Output:</h3>
                                <pre className="bg-gray-900/50 p-3 rounded-md text-sm whitespace-pre-wrap">{runResult.stdout || runResult.stderr}</pre>
                            </div>
                        )
                    )
                )}
            </div>
        </div>
    )
};
        
const Footer = () => {
    return (
        <footer className="w-full text-center p-4 text-gray-500 text-xs">
            © {new Date().getFullYear()} Sidhartha Singh. All Rights Reserved.
        </footer>
    );
};

const LeetCodeJudge = ({ user, onProfileClick }) => {
    const [problems, setProblems] = useState(mockProblems);
    const [currentProblem, setCurrentProblem] = useState(problems.find(p => p.id === 1));
    const [language, setLanguage] = useState('python');
    const [code, setCode] = useState(currentProblem.boilerplate.python);
    const [submissionResult, setSubmissionResult] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProblemListVisible, setIsProblemListVisible] = useState(false);
    const [customInput, setCustomInput] = useState('nums = [2,7,11,15], target = 9');
    const [runResult, setRunResult] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const pollingIntervalRef = useRef(null);

    useEffect(() => {
        setCode(currentProblem.boilerplate[language]);
        setSubmissionResult(null);
        setRunResult(null);
    }, [currentProblem, language]);

    const handleLanguageChange = (e) => setLanguage(e.target.value);
    const handleCodeChange = (newCode) => setCode(newCode);
    const handleSelectProblem = (problem) => {
        setCurrentProblem(problem);
        setIsProblemListVisible(false);
    };

    const pollForResult = (submissionId) => {
        let pollCount = 0;
        const maxPolls = 15; // 15 polls * 2 seconds = 30 second timeout

        pollingIntervalRef.current = setInterval(async () => {
            if (pollCount >= maxPolls) {
                clearInterval(pollingIntervalRef.current);
                setSubmissionResult({ status: 'Timeout' });
                setIsSubmitting(false);
                return;
            }

            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/submissions/${submissionId}`);
                if (!res.ok) throw new Error('Polling failed');
                const data = await res.json();
                
                setSubmissionResult(data);

                if (data.status !== 'PENDING' && data.status !== 'Running') {
                    clearInterval(pollingIntervalRef.current);
                    setIsSubmitting(false);
                }
            } catch (error) {
                console.error("Polling error:", error);
                setSubmissionResult({ status: 'Polling Error' });
                clearInterval(pollingIntervalRef.current);
                setIsSubmitting(false);
            }
            pollCount++;
        }, 2000);
    };
    
    const handleRun = async () => {
        if (isRunning) return;
        setIsRunning(true);
        setRunResult({ stdout: "Running..." });
        setSubmissionResult(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language: language,
                    code: code,
                    input: customInput,
                }),
            });
            if (!response.ok) {
                 throw new Error(`Network response was not ok, status: ${response.status}`);
            }
            const data = await response.json();
            setRunResult(data);
        } catch (error) {
            console.error("Run failed:", error);
            setRunResult({ stderr: "Run failed. Ensure your backend is running and the `/api/v1/run` endpoint is configured correctly." });
        } finally {
            setIsRunning(false);
        }
    };


    const handleSubmit = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setSubmissionResult({ status: 'PENDING' });
        setRunResult(null);

        await new Promise(resolve => setTimeout(resolve, 50));

        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/submissions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.uid,
                    problem_id: currentProblem.id,
                    code: code,
                    language: language,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            pollForResult(data.submission_id);

        } catch (error) {
            console.error("Submission failed:", error);
            setSubmissionResult({ status: 'Submission Error' });
            setIsSubmitting(false);
        }
    };
    
    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        };
    }, []);

    return (
        <div className="flex flex-col h-screen font-sans bg-gray-900 text-gray-200">
            {isProblemListVisible && <ProblemListModal problems={problems} onSelectProblem={handleSelectProblem} onClose={() => setIsProblemListVisible(false)} />}
            <header className="flex-shrink-0 bg-gray-800 shadow-md z-10">
                <div className="h-14 flex items-center justify-between px-4">
                    <div className="flex-1 flex justify-start">
                        <button onClick={() => setIsProblemListVisible(true)} className="flex items-center gap-2 text-sm bg-gray-700 hover:bg-gray-600 text-white font-semibold py-1.5 px-3 rounded-md transition">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                            Problems
                        </button>
                    </div>
                    <div className="flex-1 flex justify-center gap-4">
                        <button onClick={handleRun} disabled={isRunning || isSubmitting} className="px-6 py-1.5 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-500 disabled:bg-gray-700 transition">
                            {isRunning ? 'Running...' : 'Run'}
                        </button>
                        <button onClick={handleSubmit} disabled={isSubmitting || isRunning} className="px-6 py-1.5 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:bg-gray-700 transition">
                            {isSubmitting ? 'Submitting...' : 'Submit'}
                        </button>
                    </div>
                    <div className="flex-1 flex justify-end">
                        <div className="relative">
                            <img src={user.photoURL || 'https://placehold.co/32x32/666/fff?text=U'} alt="User" className="w-8 h-8 rounded-full cursor-pointer" onClick={onProfileClick} />
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-grow flex flex-col md:flex-row overflow-hidden p-2 gap-2">
                <div className="w-full md:w-1/2 h-full flex flex-col bg-gray-800 rounded-lg overflow-hidden">
                   <ProblemDescription problem={currentProblem} />
                </div>
                <div className="w-full md:w-1/2 h-full flex flex-col rounded-lg overflow-hidden">
                    <div className="flex-shrink-0 flex items-center justify-between bg-gray-800 px-4 py-2 rounded-t-lg">
                        <select value={language} onChange={handleLanguageChange} className="px-3 py-1 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="python">Python</option>
                            <option value="javascript">JavaScript</option>
                            <option value="java">Java</option>
                            <option value="cpp">C++</option>
                        </select>
                    </div>
                    <div className="flex-grow relative" style={{minHeight: '200px'}}>
                       <CodeEditor language={language} boilerplate={code} onCodeChange={handleCodeChange} />
                    </div>
                    <div className="flex-shrink-0">
                         <ResultPanel result={submissionResult} runResult={runResult} customInput={customInput} onCustomInputChange={(e) => setCustomInput(e.target.value)} />
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

const LandingPage = ({ onLoginClick }) => {
    return (
        <div className="h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
            <div className="flex-grow flex flex-col items-center justify-center">
                <h1 className="text-5xl font-bold mb-4">Welcome to LeetCode Judge</h1>
                <p className="text-xl text-gray-400 mb-8">Hone your skills. Prepare for interviews. Get hired.</p>
                <button onClick={onLoginClick} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition">Login / Sign Up</button>
            </div>
            <Footer />
        </div>
    );
};

const LoginPage = ({ onGoogleLogin, onGithubLogin, onBack, error }) => {
    return (
         <div className="h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm p-8 bg-gray-800 rounded-lg shadow-lg">
                <button onClick={onBack} className="text-gray-400 hover:text-white mb-6">&larr; Back</button>
                <h2 className="text-3xl font-bold text-center mb-6">Get Started</h2>
                {error && <p className="bg-red-900/50 text-red-300 text-sm text-center p-3 rounded-md mb-4">{error}</p>}
                <div className="space-y-4">
                     <button onClick={onGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition">
                        <svg className="w-6 h-6" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.99,36.59,44,31.016,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
                        Sign in with Google
                    </button>
                    <button onClick={onGithubLogin} className="w-full flex items-center justify-center gap-3 bg-gray-900 hover:bg-black text-white font-bold py-3 px-4 rounded-lg transition">
                        <svg className="w-6 h-6" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36 .09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>
                        Sign in with GitHub
                    </button>
                </div>
            </div>
            <Footer />
        </div>
    );
};

const DashboardPage = ({ user, onLogout, onBackToApp }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [socials, setSocials] = useState({
        instagram: '',
        linkedin: '',
        facebook: '',
        stackoverflow: '',
        github: ''
    });

    useEffect(() => {
        const fetchSocials = async () => {
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(userDocRef);
                if (docSnap.exists()) {
                    setSocials(docSnap.data().socials || {});
                }
            }
        };
        fetchSocials();
    }, [user]);


    const handleSocialChange = (e) => {
        const { name, value } = e.target;
        setSocials(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            try {
                await setDoc(userDocRef, { socials }, { merge: true });
                console.log("Social links saved successfully!");
                setIsEditing(false);
            } catch (error) {
                console.error("Error saving social links:", error);
            }
        }
    };

    return (
        <div className="h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md p-8 bg-gray-800 rounded-lg shadow-lg text-center">
                <button onClick={onBackToApp} className="text-gray-400 hover:text-white mb-6 float-left">&larr; Back to Problems</button>
                <div className="clear-both"></div>
                <img src={user.photoURL || 'https://placehold.co/96x96/666/fff?text=U'} alt="User" className="w-24 h-24 rounded-full mx-auto mb-4" />
                <h2 className="text-2xl font-bold">{user.displayName || 'Anonymous User'}</h2>
                <p className="text-gray-400 mb-6">{user.email}</p>
                
                <div className="border-t border-gray-700 pt-6 mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-300">Connect Your Socials</h3>
                        <button onClick={() => setIsEditing(!isEditing)} className="text-sm bg-gray-700 hover:bg-gray-600 text-white font-semibold py-1 px-3 rounded-md transition">
                            {isEditing ? 'Cancel' : 'Edit'}
                        </button>
                    </div>

                    {isEditing ? (
                        <div className="space-y-4 text-left">
                            <div>
                                <label className="text-xs font-semibold text-gray-400">Instagram URL</label>
                                <input type="text" name="instagram" value={socials.instagram} onChange={handleSocialChange} className="w-full mt-1 p-2 bg-gray-900 border border-gray-600 rounded-md text-sm" placeholder="https://instagram.com/username" />
                            </div>
                             <div>
                                <label className="text-xs font-semibold text-gray-400">LinkedIn URL</label>
                                <input type="text" name="linkedin" value={socials.linkedin} onChange={handleSocialChange} className="w-full mt-1 p-2 bg-gray-900 border border-gray-600 rounded-md text-sm" placeholder="https://linkedin.com/in/username" />
                            </div>
                             <div>
                                <label className="text-xs font-semibold text-gray-400">Facebook URL</label>
                                <input type="text" name="facebook" value={socials.facebook} onChange={handleSocialChange} className="w-full mt-1 p-2 bg-gray-900 border border-gray-600 rounded-md text-sm" placeholder="https://facebook.com/username" />
                            </div>
                             <div>
                                <label className="text-xs font-semibold text-gray-400">Stack Overflow URL</label>
                                <input type="text" name="stackoverflow" value={socials.stackoverflow} onChange={handleSocialChange} className="w-full mt-1 p-2 bg-gray-900 border border-gray-600 rounded-md text-sm" placeholder="https://stackoverflow.com/users/userid/username" />
                            </div>
                             <div>
                                <label className="text-xs font-semibold text-gray-400">GitHub URL</label>
                                <input type="text" name="github" value={socials.github} onChange={handleSocialChange} className="w-full mt-1 p-2 bg-gray-900 border border-gray-600 rounded-md text-sm" placeholder="https://github.com/username" />
                            </div>
                            <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition">
                                Save
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-6">
                            <a href={socials.instagram || '#'} target="_blank" rel="noopener noreferrer" className={socials.instagram ? 'text-gray-400 hover:text-white transition' : 'text-gray-600 cursor-not-allowed'} title="Instagram"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M7.8,2H16.2C19.4,2 22,4.6 22,7.8V16.2A5.8,5.8 0 0,1 16.2,22H7.8C4.6,22 2,19.4 2,16.2V7.8A5.8,5.8 0 0,1 7.8,2M7.6,4A3.6,3.6 0 0,0 4,7.6V16.4C4,18.39 5.61,20 7.6,20H16.4A3.6,3.6 0 0,0 20,16.4V7.6C20,5.61 18.39,4 16.4,4H7.6M17.25,5.5A1.25,1.25 0 0,1 18.5,6.75A1.25,1.25 0 0,1 17.25,8A1.25,1.25 0 0,1 16,6.75A1.25,1.25 0 0,1 17.25,5.5M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9Z" /></svg></a>
                            <a href={socials.linkedin || '#'} target="_blank" rel="noopener noreferrer" className={socials.linkedin ? 'text-gray-400 hover:text-white transition' : 'text-gray-600 cursor-not-allowed'} title="LinkedIn"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M19,3A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3H19M18.5,18.5V13.2A3.26,3.26 0 0,0 15.24,9.94C14.39,9.94 13.4,10.43 12.92,11.24V10.13H10.13V18.5H12.92V13.57C12.92,12.8 13.54,12.17 14.31,12.17A1.4,1.4 0 0,1 15.71,13.57V18.5H18.5M6.88,8.56A1.68,1.68 0 0,0 8.56,6.88C8.56,6 7.78,5.2 6.88,5.2A1.69,1.69 0 0,0 5.2,6.88C5.2,7.78 6,8.56 6.88,8.56M8.27,18.5V10.13H5.5V18.5H8.27Z" /></svg></a>
                            <a href={socials.facebook || '#'} target="_blank" rel="noopener noreferrer" className={socials.facebook ? 'text-gray-400 hover:text-white transition' : 'text-gray-600 cursor-not-allowed'} title="Facebook"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.32 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z" /></svg></a>
                            <a href={socials.stackoverflow || '#'} target="_blank" rel="noopener noreferrer" className={socials.stackoverflow ? 'text-gray-400 hover:text-white transition' : 'text-gray-600 cursor-not-allowed'} title="Stack Overflow"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M17.5,20H6.5V18H17.5V20M18,17H6A1,1 0 0,1 5,16V11H7V15H18V17M19,14H5V9H7V13H19V14M20,12H5V7H7V11H20V12M21,5H5V2H21V5Z" /></svg></a>
                            <a href={socials.github || '#'} target="_blank" rel="noopener noreferrer" className={socials.github ? 'text-gray-400 hover:text-white transition' : 'text-gray-600 cursor-not-allowed'} title="GitHub"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36 .09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg></a>
                        </div>
                    )}
                </div>
                <button onClick={onLogout} className="mt-8 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition">Logout</button>
            </div>
            <Footer />
        </div>
    );
};

export default function App() {
    const [user, setUser] = useState(null);
    const [view, setView] = useState('landing');
    const [authError, setAuthError] = useState(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setUser(user);
            setIsAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    useEffect(() => {
        if (user && view === 'login') {
            setView('app');
        }
    }, [user, view]);

    const handleLoginClick = () => {
        if (user) {
            setView('app');
        } else {
            setView('login');
        }
    };

    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            setAuthError(null);
        } catch (error) {
            console.error("Google login error:", error.code, error.message);
            setAuthError(`Login Failed: ${error.message}`);
        }
    };
    
    const handleGithubLogin = async () => {
        const provider = new GithubAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            setAuthError(null);
        } catch (error) {
            console.error("GitHub login error:", error.code, error.message);
            if (error.code === 'auth/account-exists-with-different-credential') {
                setAuthError('An account already exists with the same email address. Try logging in with Google.');
            } else {
                setAuthError(`Login Failed: ${error.message}`);
            }
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setView('landing');
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    if (isAuthLoading) {
        return (
            <div className="h-screen bg-gray-900 flex items-center justify-center text-white">
                <p>Loading...</p>
            </div>
        );
    }

    switch (view) {
        case 'login':
            return <LoginPage onGoogleLogin={handleGoogleLogin} onGithubLogin={handleGithubLogin} onBack={() => setView('landing')} error={authError} />;
        case 'app':
            if (!user) return <LandingPage onLoginClick={handleLoginClick} />;
            return <LeetCodeJudge user={user} onLogout={handleLogout} onProfileClick={() => setView('dashboard')} />;
        case 'dashboard':
            if (!user) return <LandingPage onLoginClick={handleLoginClick} />;
            return <DashboardPage user={user} onLogout={handleLogout} onBackToApp={() => setView('app')} />;
        case 'landing':
        default:
            return <LandingPage onLoginClick={handleLoginClick} />;
    }
};
