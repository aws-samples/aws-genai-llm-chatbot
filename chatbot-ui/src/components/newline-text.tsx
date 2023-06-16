function NewlineText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((str, lineNum) => (
        <p key={lineNum}>{str}</p>
      ))}
    </>
  );
}

export default NewlineText;
