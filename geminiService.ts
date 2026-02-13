export const analyzeVisual = async (input: any, isMedical: boolean) => {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input, isMedical }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Server error");
  }

  return await response.json();
};
