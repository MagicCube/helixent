export interface InputEditorState {
  text: string;
  cursorOffset: number;
}

export function insertTextAtCursor(state: InputEditorState, input: string): InputEditorState {
  if (input.length === 0) return state;

  return {
    text: state.text.slice(0, state.cursorOffset) + input + state.text.slice(state.cursorOffset),
    cursorOffset: state.cursorOffset + input.length,
  };
}

export function removeCharacterBeforeCursor(state: InputEditorState): InputEditorState {
  if (state.cursorOffset === 0) return state;

  return {
    text: state.text.slice(0, state.cursorOffset - 1) + state.text.slice(state.cursorOffset),
    cursorOffset: state.cursorOffset - 1,
  };
}

export function moveCursorLeft(state: InputEditorState): InputEditorState {
  return {
    ...state,
    cursorOffset: Math.max(0, state.cursorOffset - 1),
  };
}

export function moveCursorRight(state: InputEditorState): InputEditorState {
  return {
    ...state,
    cursorOffset: Math.min(state.text.length, state.cursorOffset + 1),
  };
}
