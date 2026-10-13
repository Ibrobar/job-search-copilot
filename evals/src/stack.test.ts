import { describe, expect, it } from "vitest";
import { favoredStack, stackHits } from "./stack";

describe("stackHits", () => {
  it("does not count JavaScript as Java", () => {
    expect(stackHits("JavaScript and Java Script").java).toBe(0);
    expect(stackHits("Java 17, Spring Boot").java).toBe(2);
  });
});

describe("favoredStack", () => {
  it("picks a clearly dominant stack", () => {
    expect(favoredStack("React, TypeScript, Node.js, Next.js front-end work")).toBe("web");
    expect(favoredStack("Java, Spring Boot, Kafka, Hibernate, JVM tuning")).toBe("java");
    expect(favoredStack("Python, pandas, Airflow, Databricks ETL")).toBe("data");
  });

  it("returns null for mixed or thin postings", () => {
    expect(favoredStack("React, TypeScript, Java, Spring Boot")).toBeNull();
    expect(favoredStack("Great communicator, team player")).toBeNull();
    expect(favoredStack("React and Python")).toBeNull();
  });
});
