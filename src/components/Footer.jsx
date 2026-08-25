import React, { useLayoutEffect, useRef } from 'react';
import '../css/Footer.css';


function Footer() {
  const footerRef = useRef(null);

  // Publish the footer's real height so full-height pages can subtract it
  // instead of guessing (mirrors how Navbar publishes --navbar-height).
  useLayoutEffect(() => {
    const updateFooterHeight = () => {
      const height = footerRef.current?.getBoundingClientRect().height;

      if (height) {
        document.documentElement.style.setProperty('--footer-height', `${Math.ceil(height)}px`);
      }
    };

    updateFooterHeight();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateFooterHeight)
      : null;

    if (resizeObserver && footerRef.current) {
      resizeObserver.observe(footerRef.current);
    }

    window.addEventListener('resize', updateFooterHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateFooterHeight);
    };
  }, []);

  return (
    <footer ref={footerRef} className="footer">
      &copy; {new Date().getFullYear()} fitznet.org by Matthew Fitzgerald
    </footer>
  );
}

export default Footer;
