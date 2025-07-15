#!/bin/bash

# 📁 Скрипт настройки folder в Yandex Cloud
# Использование: ./scripts/setup-yandex-folder.sh

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Показ доступных folders
show_folders() {
    print_status "Показываю доступные folders..."
    
    echo "📁 Доступные folders:"
    yc resource-manager folder list --format json | jq -r '.[] | "  • \(.name) (ID: \(.id))"' 2>/dev/null || {
        # Fallback если jq не работает
        yc resource-manager folder list
    }
    
    echo ""
    CURRENT_FOLDER=$(yc config get folder-id)
    echo "🔑 Текущий folder: $CURRENT_FOLDER"
}

# Проверка прав в текущем folder
check_current_permissions() {
    print_status "Проверяю права в текущем folder..."
    
    local has_compute=false
    local has_vpc=false
    local has_resource_manager=false
    
    # Проверка прав на compute
    if yc compute disk list --limit 1 &>/dev/null; then
        print_success "✅ Права на Compute Engine есть"
        has_compute=true
    else
        print_warning "❌ Нет прав на Compute Engine"
    fi
    
    # Проверка прав на VPC
    if yc vpc network list --limit 1 &>/dev/null; then
        print_success "✅ Права на VPC есть"
        has_vpc=true
    else
        print_warning "❌ Нет прав на VPC"
    fi
    
    # Проверка прав на создание folders
    if yc resource-manager folder list &>/dev/null; then
        print_success "✅ Права на Resource Manager есть"
        has_resource_manager=true
    else
        print_warning "❌ Нет прав на Resource Manager"
    fi
    
    echo ""
    if [ "$has_compute" = true ] && [ "$has_vpc" = true ]; then
        print_success "🎉 У вас есть все необходимые права для создания VM!"
        return 0
    else
        print_warning "⚠️ Недостаточно прав для создания VM"
        return 1
    fi
}

# Переключение на другой folder
switch_folder() {
    show_folders
    
    echo ""
    read -p "🔑 Введите ID folder для переключения: " NEW_FOLDER_ID
    
    if [ -z "$NEW_FOLDER_ID" ]; then
        print_error "ID folder не может быть пустым"
        return 1
    fi
    
    print_status "Переключаюсь на folder $NEW_FOLDER_ID..."
    
    if yc config set folder-id "$NEW_FOLDER_ID"; then
        print_success "Успешно переключились на folder $NEW_FOLDER_ID"
        check_current_permissions
    else
        print_error "Не удалось переключиться на folder $NEW_FOLDER_ID"
        return 1
    fi
}

# Создание нового folder
create_folder() {
    read -p "📛 Имя нового folder: " FOLDER_NAME
    
    if [ -z "$FOLDER_NAME" ]; then
        print_error "Имя folder не может быть пустым"
        return 1
    fi
    
    print_status "Создаю folder '$FOLDER_NAME'..."
    
    local FOLDER_INFO
    FOLDER_INFO=$(yc resource-manager folder create --name "$FOLDER_NAME" --format json 2>&1)
    
    if echo "$FOLDER_INFO" | grep -q "ERROR:"; then
        print_error "Ошибка при создании folder:"
        echo "$FOLDER_INFO"
        return 1
    fi
    
    local NEW_FOLDER_ID
    NEW_FOLDER_ID=$(echo "$FOLDER_INFO" | jq -r '.id')
    
    print_success "Folder создан с ID: $NEW_FOLDER_ID"
    
    read -p "🔄 Переключиться на новый folder? (y/n): " SWITCH_NOW
    if [[ $SWITCH_NOW =~ ^[Yy] ]]; then
        yc config set folder-id "$NEW_FOLDER_ID"
        print_success "Переключились на новый folder"
        check_current_permissions
    fi
}

# Показ информации о ролях
show_roles_info() {
    echo "🔑 Необходимые роли для создания VM:"
    echo ""
    echo "📋 Роли для пользователя:"
    echo "  • compute.admin - создание и управление VM"
    echo "  • vpc.admin - создание и управление сетей"
    echo "  • resource-manager.clouds.member - базовый доступ"
    echo ""
    echo "🔗 Как назначить роли:"
    echo "  1. Перейдите в консоль Yandex Cloud"
    echo "  2. Выберите нужный folder"
    echo "  3. Перейдите в 'Участники и роли'"
    echo "  4. Добавьте пользователя с нужными ролями"
    echo ""
    echo "📖 Документация:"
    echo "  https://cloud.yandex.ru/docs/iam/operations/roles/grant"
}

# Главное меню
main_menu() {
    echo "📁 Управление folders в Yandex Cloud"
    echo "=================================="
    
    while true; do
        echo ""
        echo "Выберите действие:"
        echo "  1) 📋 Показать доступные folders"
        echo "  2) 🔍 Проверить права в текущем folder"
        echo "  3) 🔄 Переключиться на другой folder"
        echo "  4) ➕ Создать новый folder"
        echo "  5) 🔑 Информация о ролях"
        echo "  6) 🚪 Выход"
        
        read -p "Ваш выбор (1-6): " choice
        
        case $choice in
            1)
                show_folders
                ;;
            2)
                check_current_permissions
                ;;
            3)
                switch_folder
                ;;
            4)
                create_folder
                ;;
            5)
                show_roles_info
                ;;
            6)
                print_success "До свидания!"
                exit 0
                ;;
            *)
                print_error "Неверный выбор. Попробуйте еще раз."
                ;;
        esac
    done
}

# Проверка yc CLI
if ! command -v yc &> /dev/null; then
    print_error "Yandex Cloud CLI не установлен"
    print_status "Установите CLI: https://cloud.yandex.ru/docs/cli/quickstart"
    exit 1
fi

# Проверка авторизации
if ! yc config list &> /dev/null; then
    print_error "Yandex Cloud CLI не настроен"
    print_status "Выполните: yc init"
    exit 1
fi

# Запуск главного меню
main_menu 
