export default function GlobalFooter() {

  const footerStyles = {
    display: 'flex',
    color: '#4a4a4a',
    fontSize: '0.9rem',
    lineHeight: '1.2em',
    padding: '0.5rem 1.5rem',
    gap: 8,
  }

  return (
    <footer style={footerStyles} id="footer">
      Copyright © 2024&nbsp;San Joaquin Delta College
      <a href="https://www.deltacollege.edu/campus-offices/marketing-and-communications/privacy-cookie-statement">Privacy and Cookie Statement</a>
      <strong>
        <a href="https://www.deltacollege.edu/campus-offices/marketing-and-communications/web-help-form">Report a Website Issue</a>
      </strong>
    </footer>
  );
}
