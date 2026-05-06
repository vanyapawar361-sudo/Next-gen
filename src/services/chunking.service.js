/**
 * Splits text into chunks of approximately maxWords words.
 * This is a basic chunking by words, though in production you might use 
 * advanced strategies like LangChain's RecursiveCharacterTextSplitter.
 */
function chunkText(text, maxWords = 400) {
  const words = text.split(' ');
  const chunks = [];
  let currentChunk = [];

  for (let word of words) {
    currentChunk.push(word);
    if (currentChunk.length >= maxWords) {
      chunks.push(currentChunk.join(' '));
      // Overlap: keep last 50 words for the next chunk
      currentChunk = currentChunk.slice(-50);
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

module.exports = { chunkText };
