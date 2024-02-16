function toCamelCase(str) {
  return (
    str
      // Split the string into words using a regular expression that
      // matches spaces, underscores, and dashes as word boundaries.
      .split(/[\s_\-]+/)
      // Map each word to a new word.
      .map((word, index) =>
        // If it's the first word, make it lowercase.
        // Otherwise, capitalize the first letter and make the rest lowercase.
        index === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      // Join all the words into a single string.
      .join("")
  );
}

exports.toCamelCase = toCamelCase;
