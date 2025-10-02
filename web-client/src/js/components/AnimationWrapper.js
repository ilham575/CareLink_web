import React from 'react';

const animationStyle = {
	animation: 'fadeSlideIn 0.6s cubic-bezier(0.4,0,0.2,1)'
};

const AnimationWrapper = ({ children }) => (
	<div style={animationStyle} className="animation-fade-slide">
		{children}
	</div>
);

export default AnimationWrapper;

// Animation CSS
// เพิ่ม CSS นี้ใน global css หรือ import ใน index.css
/*
@keyframes fadeSlideIn {
	from {
		opacity: 0;
		transform: translateY(32px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
.animation-fade-slide {
	will-change: opacity, transform;
}
*/
