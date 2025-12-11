
from playwright.sync_api import Page, expect, sync_playwright
import time

def verify_dashboard(page: Page):
    # 1. Arrange: Go to the app
    page.goto("http://localhost:3000")
    
    # Wait for loading to finish
    try:
        page.wait_for_selector("text=Привет, Студент", timeout=10000)
    except:
        # Retry once
        page.reload()
        page.wait_for_selector("text=Привет, Студент", timeout=10000)

    # 2. Act & Assert: Check main elements
    expect(page.get_by_role("heading", name="LusoLearn")).to_be_visible()
    expect(page.get_by_text("Мои слова (0)")).to_be_visible()
    
    # 3. Screenshot Dashboard
    page.screenshot(path="verification/dashboard.png")
    
    # 4. Check Stats Widget (Extracted Component)
    expect(page.get_by_text("Статистика")).to_be_visible()
    expect(page.get_by_text("Добавлено")).to_be_visible()
    # Use exact=True to avoid ambiguity
    expect(page.get_by_text("Выучено слов", exact=True)).to_be_visible()

    # 5. Check WordListModal (Extracted Component)
    # Click on "Выучено слов" to open the list
    page.get_by_text("Выучено слов", exact=True).click()
    # Expect modal to open
    page.wait_for_selector("text=Выучено (0)")
    page.screenshot(path="verification/word_list_modal.png")
    # Close modal by pressing Esc or reloading
    page.reload()
    page.wait_for_selector("text=Привет, Студент", timeout=10000)

    # 6. Check Navigation to Create
    page.get_by_role("button", name="Создать").first.click()
    page.wait_for_selector("text=Новые карточки")
    page.screenshot(path="verification/create_page.png")
    
    # 7. Check Navigation back to Dashboard
    page.get_by_text("Отмена").click()
    expect(page.get_by_text("Привет, Студент")).to_be_visible()

    # 8. Check Study Config Modal
    # Click the Study button (Dashboard main view)
    page.get_by_role("button", name="Учить").first.click() 
    
    # Wait for study view or session completed
    try:
        page.wait_for_selector("text=Сессия завершена!", timeout=5000)
        print("Session completed screen visible (No cards)")
    except:
        page.wait_for_selector(".rotate-y-180", state="attached", timeout=5000)
        print("Card view visible")
        
    page.screenshot(path="verification/study_view.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_dashboard(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_retry.png")
            raise e
        finally:
            browser.close()
