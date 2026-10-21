import { describe, expect, it } from 'vitest';
import { academyDraftProblem, academyPublicationIssues, cloneAcademyContent, cloneAcademyLesson, cloneAcademyQuestion } from '@/lib/akademie/workspaceAuthoring';
import { ACADEMY_LESSON_PRESETS, ACADEMY_TEMPLATES, createAcademyLessonPreset, createAcademyTemplate } from '@/lib/akademie/workspaceTemplates';

describe('Academy authoring and reusable content', () => {
  it('clones content with independent identifiers and preserves the selected answer, without changing the original', () => {
    const source = createAcademyTemplate('workshop');
    const original = structuredClone(source);
    const copy = cloneAcademyContent(source);
    expect(source).toEqual(original);
    expect(copy.lessons.map(lesson => lesson.id).some(id => source.lessons.some(lesson => lesson.id === id))).toBe(false);
    const sourceQuestion = source.lessons[2].questions![0];
    const question = copy.lessons[2].questions![0];
    expect(question.id).not.toBe(sourceQuestion.id);
    expect(question.options.find(option => option.id === question.correctOptionId)?.text)
      .toBe(sourceQuestion.options.find(option => option.id === sourceQuestion.correctOptionId)?.text);
    expect(question.options.some(option => sourceQuestion.options.some(originalOption => option.id === originalOption.id))).toBe(false);
    question.options[0].text = 'Neue Antwort';
    copy.audiences.pop();
    expect(source).toEqual(original);
    const lessonCopy = cloneAcademyLesson(source.lessons[2]);
    expect(lessonCopy.questions![0].correctOptionId).not.toBe(sourceQuestion.correctOptionId);
  });

  it('never invents a correct answer when copying an unfinished or redacted question', () => {
    const question = createAcademyLessonPreset('true-false').questions![0];
    expect(cloneAcademyQuestion(question).correctOptionId).toBeUndefined();
    expect(cloneAcademyQuestion({ ...question, correctOptionId: 'no-longer-present' }).correctOptionId).toBeUndefined();
  });

  it('keeps every starter consistent with its visible category, duration and lesson count', () => {
    expect(ACADEMY_TEMPLATES).toHaveLength(15);
    for (const template of ACADEMY_TEMPLATES) {
      const content = createAcademyTemplate(template.key);
      expect(content.category).toBe(template.category);
      expect(content.estimatedMinutes).toBe(template.estimatedMinutes);
      expect(content.lessons).toHaveLength(template.lessonCount);
      expect(content.audiences).toEqual(template.audiences);
      expect(academyDraftProblem({ ...content, title: content.title || 'Eigene Schulung' })).toBeNull();
      expect(academyPublicationIssues(content).length).toBeGreaterThan(0);
    }
  });

  it('creates reusable lesson presets without shared state or executable material URLs', () => {
    expect(ACADEMY_LESSON_PRESETS).toHaveLength(10);
    for (const preset of ACADEMY_LESSON_PRESETS) {
      const first = createAcademyLessonPreset(preset.key);
      const second = createAcademyLessonPreset(preset.key);
      expect(first.kind).toBe(preset.kind);
      expect(first.id).not.toBe(second.id);
      expect(first.url).toBeUndefined();
      if (first.questions) {
        expect(first.questions[0].id).not.toBe(second.questions![0].id);
        expect(first.questions[0].correctOptionId).toBeUndefined();
      }
    }
  });

  it('separates an unfinished saveable draft from complete publishable content and identifies the affected lesson', () => {
    const content = createAcademyTemplate('blank');
    content.title = 'Eigener Kurs';
    expect(academyDraftProblem(content)).toBeNull();
    expect(academyPublicationIssues(content)).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'summary' }), expect.objectContaining({ lessonId: content.lessons[0].id }),
    ]));
    content.summary = 'Ein klar beschriebenes Lernziel.';
    content.lessons[0].title = 'Einführung';
    content.lessons[0].body = 'Der selbst erstellte Lerninhalt.';
    expect(academyPublicationIssues(content)).toEqual([]);
    const quiz = createAcademyLessonPreset('quiz');
    content.lessons.push(quiz);
    expect(academyDraftProblem(content)).toBeNull();
    expect(academyPublicationIssues(content).every(issue => issue.lessonId === quiz.id)).toBe(true);
    quiz.questions![0].prompt = 'Welche Antwort trifft zu?';
    quiz.questions![0].options[0].text = 'Die erste Antwort.';
    quiz.questions![0].options[1].text = 'Die zweite Antwort.';
    quiz.questions![0].correctOptionId = quiz.questions![0].options[1].id;
    expect(academyPublicationIssues(content)).toEqual([]);
  });

  it('rejects unsafe links, invalid counts and broken answer references before saving a draft', () => {
    const content = createAcademyTemplate('workshop');
    content.lessons[0].url = 'https://name:secret@example.org/material';
    expect(academyDraftProblem(content)).toMatch('HTTPS');
    delete content.lessons[0].url;
    content.maxAttempts = 21;
    expect(academyDraftProblem(content)).toMatch('Versuchsanzahl');
    content.maxAttempts = 3;
    content.lessons[2].questions![0].correctOptionId = 'missing';
    expect(academyDraftProblem(content)).toMatch('nicht mehr vorhanden');
  });
});
