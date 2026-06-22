import { useMemo, useState } from "react";
import A2UIQuestionnaire from "../A2UIQuestionnaire";

interface QuestionItem {
  id: string | number;
  name: string;
  options: string[]; // Lưu ý: Đôi khi BE trả về kiểu dữ liệu lạ, ta sẽ phòng hờ bên dưới
}

interface A2UIQuestionnaireBatchProps {
  questions: QuestionItem[];
  onSubmitAll: (
    answers: { attribute_id: string | number; selected_options: string[] }[],
  ) => void;
}

export default function A2UIQuestionnaireBatch({
  questions,
  onSubmitAll,
}: A2UIQuestionnaireBatchProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Đã sửa lại cú pháp useState chuẩn
  const [collectedAnswers, setCollectedAnswers] = useState<
    {
      attribute_id: string | number;
      selected_options: string[];
    }[]
  >([]);

  const currentQuestion = useMemo(
    () => questions[currentIndex],
    [questions, currentIndex],
  );

  const handleAnswer = (selectedIds: string | string[]) => {
    const normalized = Array.isArray(selectedIds) ? selectedIds : [selectedIds];
    const updatedAnswers = [
      ...collectedAnswers,
      { attribute_id: currentQuestion.id, selected_options: normalized },
    ];

    if (currentIndex + 1 >= questions.length) {
      onSubmitAll(updatedAnswers);
      return;
    }

    setCollectedAnswers(updatedAnswers);
    setCurrentIndex((prev) => prev + 1);
  };

  const handleSkip = () => {
    const updatedAnswers = [
      ...collectedAnswers,
      { attribute_id: currentQuestion.id, selected_options: [] },
    ];

    if (currentIndex + 1 >= questions.length) {
      onSubmitAll(updatedAnswers);
      return;
    }

    setCollectedAnswers(updatedAnswers);
    setCurrentIndex((prev) => prev + 1);
  };

  if (!currentQuestion) return null;

  return (
    <A2UIQuestionnaire
      key={currentQuestion.id}
      title={currentQuestion.name}
      options={(() => {
        let parsedOptions: unknown[] = [];

        // 1. Parse dữ liệu nếu Database trả về chuỗi JSON thay vì Mảng
        if (Array.isArray(currentQuestion.options)) {
          parsedOptions = currentQuestion.options;
        } else if (typeof currentQuestion.options === "string") {
          try {
            const parsed = JSON.parse(currentQuestion.options);
            parsedOptions = Array.isArray(parsed) ? parsed : [];
          } catch {
            parsedOptions = [];
          }
        }

        // 2. Map dữ liệu an toàn, chống mọi trường hợp null/undefined/object rỗng
        return parsedOptions.map((opt: unknown, index: number) => {
          if (typeof opt === "string") {
            return { id: opt, label: opt };
          }

          const rec =
            typeof opt === "object" && opt !== null
              ? (opt as Record<string, unknown>)
              : null;

          // Trích xuất ID và Label, có fallback về index để đảm bảo KHÔNG BAO GIỜ trùng key
          const optId =
            rec?.id ?? rec?.value ?? rec?.name ?? rec?.label ?? `opt_${index}`;
          const optLabel =
            rec?.label ?? rec?.name ?? rec?.value ?? JSON.stringify(opt);

          return {
            id: String(optId),
            label: String(optLabel),
          };
        });
      })()}
      onSubmit={handleAnswer}
      onSkip={handleSkip}
    />
  );
}
