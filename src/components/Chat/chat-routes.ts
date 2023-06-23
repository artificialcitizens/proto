export const hermesChat = async (query: string) => {
  const instruction = `This is a conversation between a human and a AI assistant. Answer the question to the best of your ability`;
  const response = await fetch(`http://192.168.4.94:5000/hermes-inference/?instruction=${instruction}?prompt=${query}`);
  return response.text();
};
