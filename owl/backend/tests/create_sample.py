from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

def create_sample_pdf(filename):
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter
    text = (
        "Artificial Intelligence in Education: A Future Perspective\n\n"
        "AI is transforming the way we learn. From personalized tutoring to automated grading, "
        "the classroom is evolving. One powerful application is the 'Audio Overview', which "
        "turns textbook content into engaging podcasts. Students can now learn while walking, "
        "exercising, or commuting. This project, OWL (Open Web Learning), aims to bridge "
        "the gap between static PDF content and dynamic AI-driven learning tools.\n\n"
        "The benefits of AI in education include:\n"
        "1. Personalized learning paths.\n"
        "2. Increased accessibility for diverse learners.\n"
        "3. Instant feedback and real-time support.\n\n"
        "Conclusion: AI is not a replacement for teachers but a powerful assistant."
    )
    
    y = height - 50
    for line in text.split('\n'):
        c.drawString(50, y, line)
        y -= 20
        
    c.save()

if __name__ == "__main__":
    create_sample_pdf("sample.pdf")
    print("Sample PDF 'sample.pdf' created successfully.")
