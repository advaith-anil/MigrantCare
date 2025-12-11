(async () => {
    const { faqResponses } = await import('./response.js'); // Dynamically import predefined responses

    const sendBtn = document.querySelector(".chat-input span");
    const micBtn = document.querySelector(".chat-input a");
    const chatInput = document.querySelector(".chat-input textarea");
    const chatbox = document.querySelector(".chatbox");
    const inputHeight = chatInput.scrollHeight;
    const languageSelect = document.querySelector("#language-select"); // Language dropdown element

    if (!languageSelect) {
        console.error("Language dropdown element not found. Please ensure it exists in the DOM.");
        return;
    }

    let API_KEY = '';

    try {
        const response = await fetch('/getChatbotApiKey');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        API_KEY = data.apiKey;
    } catch (error) {
        console.error('Error fetching API key:', error);
    }

    const createChatLi = (msg, className) => {
        const chatLi = document.createElement("li");
        chatLi.classList.add("chat", className);
        let chatContent = className === "outgoing" ? `<p>${msg}</p>` : `<span class="material-symbols-outlined">smart_toy</span><p>${msg}</p>`;
        chatLi.innerHTML = chatContent;
        chatLi.querySelector('p').textContent = msg;
        return chatLi;
    };

    // Removed generateResponse function as it uses the Gemini model

    const translateText = async (text) => {
        const sourceLang = languageSelect?.value || "en"; // Get source language from dropdown
        const targetLang = "en"; // Always translate to English
        try {
            const response = await fetch("http://localhost:5001/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, source_language: sourceLang, target_language: targetLang }) // Ensure correct source and target languages
            });

            if (!response.ok) {
                throw new Error(`Failed to translate text: ${response.statusText}`);
            }

            const data = await response.json();
            return data.translation || text;
        } catch (error) {
            console.error("Error translating text:", error);
            return text;
        }
    };

    const findSimilarQuestion = async (userMsg) => {
        try {
            const response = await fetch("http://localhost:5001/calculateSimilarity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userMsg, questions: Object.keys(faqResponses) })
            });

            if (!response.ok) {
                throw new Error(`Failed to calculate similarity: ${response.statusText}`);
            }

            const data = await response.json();
            return data.bestMatch; // Return the best matching question
        } catch (error) {
            console.error("Error calculating similarity:", error);
            return null;
        }
    };

    sendBtn.addEventListener("click", async () => {
        const userMsg = chatInput.value.trim();
        if (!userMsg) return;

        chatInput.value = "";
        chatbox.appendChild(createChatLi(userMsg, "outgoing"));

        const targetLang = languageSelect?.value || "en"; // Default to English if dropdown is missing

        // Translate the user query to English
        const translatedText = await translateText(userMsg, "en");

        // Step 2: Find the most similar question using spaCy
        const matchedQuestion = await findSimilarQuestion(translatedText.toLowerCase().trim());
        if (matchedQuestion) {
            const faqResponse = faqResponses[matchedQuestion];
            const responseText = faqResponse[targetLang] || faqResponse.en || "No response available.";
            chatbox.appendChild(createChatLi(responseText, "incoming"));
        } else {
            chatbox.appendChild(createChatLi("Sorry, I couldn't find an answer to your question.", "incoming"));
        }
    });

    micBtn.addEventListener("click", async () => {
        if (!navigator.mediaDevices || !window.MediaRecorder) {
            alert("Your browser does not support audio recording.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            const audioChunks = [];
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            source.connect(analyser);
            analyser.fftSize = 256;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const noiseThreshold = 10; // Adjust this threshold to filter out background noise
            let isSpeaking = false;

            const checkNoise = () => {
                analyser.getByteFrequencyData(dataArray);
                const averageVolume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

                if (averageVolume > noiseThreshold) {
                    isSpeaking = true; // User is speaking
                } else if (isSpeaking) {
                    mediaRecorder.stop(); // Stop recording when speaking ends
                    stream.getTracks().forEach((track) => track.stop());
                }

                if (mediaRecorder.state === "recording") {
                    requestAnimationFrame(checkNoise);
                }
            };

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
                const formData = new FormData();
                formData.append("audio", audioBlob);
                formData.append("language", languageSelect?.value || "en");

                try {
                    const response = await fetch("http://localhost:5001/transcribe", {
                        method: "POST",
                        body: formData,
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || "Failed to transcribe audio.");
                    }

                    const { transcription } = await response.json();
                    chatInput.value = transcription;
                } catch (error) {
                    console.error("Error during transcription:", error);
                    alert("Failed to transcribe audio. Please ensure the audio is clear and try again.");
                }
            };

            mediaRecorder.start();
            checkNoise();
        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("Unable to access microphone. Please check your permissions.");
        }
    });

    chatInput.addEventListener("input", () => {
        chatInput.style.height = `${inputHeight}px`;
        chatInput.style.height = `${chatInput.scrollHeight}px`;
    });

    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
            e.preventDefault();
            sendBtn.click();
        }
    });
})();