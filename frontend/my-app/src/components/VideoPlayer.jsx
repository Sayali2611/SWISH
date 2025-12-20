// import { useState, useRef, useEffect } from 'react';

// const VideoPlayer = ({ src, format, type }) => {
//   const videoRef = useRef(null);
//   const containerRef = useRef(null);
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [isMuted, setIsMuted] = useState(true);
//   const [showControls, setShowControls] = useState(false);
//   const [isInView, setIsInView] = useState(false);

//   // LinkedIn-style: Auto-play when in viewport, auto-pause when out
//   useEffect(() => {
//     const observer = new IntersectionObserver(
//       (entries) => {
//         entries.forEach(entry => {
//           setIsInView(entry.isIntersecting);
          
//           if (entry.isIntersecting) {
//             // Video entered viewport - try to play
//             if (videoRef.current) {
//               const playPromise = videoRef.current.play();
//               if (playPromise !== undefined) {
//                 playPromise
//                   .then(() => {
//                     setIsPlaying(true);
//                   })
//                   .catch(error => {
//                     console.log("Auto-play prevented:", error);
//                     // Browser blocked auto-play, show play button
//                   });
//               }
//             }
//           } else {
//             // Video left viewport - pause
//             if (videoRef.current && !videoRef.current.paused) {
//               videoRef.current.pause();
//               setIsPlaying(false);
//             }
//           }
//         });
//       },
//       {
//         threshold: 0.5, // 50% of video should be visible
//         rootMargin: '50px' // Start loading when 50px away
//       }
//     );

//     if (containerRef.current) {
//       observer.observe(containerRef.current);
//     }

//     return () => {
//       if (containerRef.current) {
//         observer.unobserve(containerRef.current);
//       }
//     };
//   }, []);

//   // Handle video click (LinkedIn: click to mute/unmute)
//   const handleVideoClick = () => {
//     if (videoRef.current) {
//       if (isMuted) {
//         videoRef.current.muted = false;
//         setIsMuted(false);
//       } else {
//         videoRef.current.muted = true;
//         setIsMuted(true);
//       }
//     }
//   };

//   // Handle play/pause
//   const handlePlayPause = () => {
//     if (videoRef.current) {
//       if (isPlaying) {
//         videoRef.current.pause();
//         setIsPlaying(false);
//       } else {
//         videoRef.current.play();
//         setIsPlaying(true);
//       }
//     }
//   };

//   // Handle video ended
//   const handleVideoEnded = () => {
//     setIsPlaying(false);
//     if (videoRef.current) {
//       videoRef.current.currentTime = 0;
//     }
//   };

//   // Handle video play
//   const handleVideoPlay = () => {
//     setIsPlaying(true);
//   };

//   // Handle video pause
//   const handleVideoPause = () => {
//     setIsPlaying(false);
//   };

//   return (
//     <div 
//       className="linkedin-video-container"
//       ref={containerRef}
//       onMouseEnter={() => setShowControls(true)}
//       onMouseLeave={() => setShowControls(false)}
//     >
//       <video
//         ref={videoRef}
//         className="linkedin-video"
//         preload="metadata"
//         muted={isMuted}
//         loop
//         playsInline
//         onClick={handleVideoClick}
//         onEnded={handleVideoEnded}
//         onPlay={handleVideoPlay}
//         onPause={handleVideoPause}
//       >
//         <source src={src} type={`${type}/${format}`} />
//         Your browser does not support the video tag.
//       </video>

//       {/* LinkedIn-style Controls */}
//       <div className={`video-controls ${showControls ? 'visible' : ''}`}>
//         {/* Play/Pause Button */}
//         <button 
//           className="control-btn play-pause-btn"
//           onClick={handlePlayPause}
//         >
//           {isPlaying ? '⏸️' : '▶️'}
//         </button>

//         {/* Mute/Unmute Button */}
//         <button 
//           className="control-btn mute-btn"
//           onClick={handleVideoClick}
//         >
//           {isMuted ? '🔇' : '🔊'}
//         </button>

//         {/* Volume Slider */}
//         <input
//           type="range"
//           className="volume-slider"
//           min="0"
//           max="1"
//           step="0.1"
//           defaultValue="0"
//           onChange={(e) => {
//             if (videoRef.current) {
//               videoRef.current.volume = e.target.value;
//               if (e.target.value > 0) {
//                 setIsMuted(false);
//                 videoRef.current.muted = false;
//               }
//             }
//           }}
//         />

//         {/* Progress Bar */}
//         <div className="progress-container">
//           <input
//             type="range"
//             className="progress-slider"
//             min="0"
//             max="100"
//             step="1"
//             defaultValue="0"
//             onChange={(e) => {
//               if (videoRef.current) {
//                 const time = (e.target.value / 100) * videoRef.current.duration;
//                 videoRef.current.currentTime = time;
//               }
//             }}
//           />
//         </div>

//         {/* Time Display */}
//         <span className="time-display">
//           {videoRef.current ? 
//             `${Math.floor(videoRef.current.currentTime || 0)}s / ${Math.floor(videoRef.current.duration || 0)}s` 
//             : '0s / 0s'}
//         </span>
//       </div>

//       {/* Overlay when not playing */}
//       {!isPlaying && (
//         <div className="video-overlay" onClick={handlePlayPause}>
//           <div className="play-button-large">
//             <span className="play-icon">▶️</span>
//           </div>
//         </div>
//       )}

//       {/* Mute indicator */}
//       {isMuted && (
//         <div className="mute-indicator">
//           <span className="mute-icon">🔇</span>
//         </div>
//       )}
//     </div>
//   );
// };

// export default VideoPlayer;