export const formatFromKebob = (kebab: string) => {
  return kebab
    .split("-")
    .map((kebabPart) => {
      return kebabPart.charAt(0).toUpperCase() + kebabPart.slice(1);
    })
    .join("");
};
