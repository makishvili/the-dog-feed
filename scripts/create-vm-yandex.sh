#!/bin/bash

# 🏗️ Скрипт создания VM в Yandex Cloud для Dog Feeding Bot
# Требует установленный yc CLI
# Использование: ./scripts/create-vm-yandex.sh

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

# Проверка yc CLI
check_yc_cli() {
    print_status "Проверяю Yandex Cloud CLI..."
    
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
    
    # Проверка jq для обработки JSON
    if ! command -v jq &> /dev/null; then
        print_error "jq не установлен"
        print_status "Установите jq: brew install jq (macOS) или apt install jq (Ubuntu)"
        exit 1
    fi
    
    print_success "Yandex Cloud CLI готов к использованию"
}

# Проверка прав и показ доступных folders
check_permissions() {
    print_status "Проверяю доступные folders и права..."
    
    echo "📁 Доступные folders:"
    yc resource-manager folder list --format json | jq -r '.[] | "  • \(.name) (ID: \(.id))"' 2>/dev/null || {
        # Fallback если jq не работает или формат не поддерживается
        yc resource-manager folder list || {
            print_error "Не удается получить список folders"
            return 1
        }
    }
    
    echo ""
    echo "🔑 Текущий folder: $CURRENT_FOLDER"
    
    # Попытка проверить права на создание VM
    print_status "Проверяю права на создание ресурсов..."
    
    # Проверка прав через попытку получить лимиты
    if yc compute disk list --limit 1 &>/dev/null; then
        print_success "Права на compute сервисы есть"
    else
        print_warning "Возможно нет прав на compute сервисы"
    fi
    
    if yc vpc network list --limit 1 &>/dev/null; then
        print_success "Права на VPC сервисы есть"
    else
        print_warning "Возможно нет прав на VPC сервисы"
    fi
}

# Сбор параметров VM
collect_vm_params() {
    print_status "Настройка параметров VM..."
    
    # Получаем текущую конфигурацию
    CURRENT_FOLDER=$(yc config get folder-id)
    CURRENT_ZONE=$(yc config get compute-default-zone 2>/dev/null)
    
    # Если зона не установлена, выбираем по умолчанию
    if [ -z "$CURRENT_ZONE" ]; then
        CURRENT_ZONE="ru-central1-a"
        print_status "Зона не установлена, использую по умолчанию: $CURRENT_ZONE"
        yc config set compute-default-zone "$CURRENT_ZONE"
    fi
    
    echo "Текущая конфигурация:"
    echo "  Folder ID: $CURRENT_FOLDER"
    echo "  Zone: $CURRENT_ZONE"
    echo ""
    
    read -p "📛 Имя VM (по умолчанию: dog-bot-vm): " VM_NAME
    VM_NAME=${VM_NAME:-dog-bot-vm}
    
    echo "Выберите тип VM:"
    echo "  1) Минимальная (1 vCPU, 2GB RAM) - ~400₽/месяц"
    echo "  2) Стандартная (2 vCPU, 4GB RAM) - ~800₽/месяц"
    echo "  3) Мощная (4 vCPU, 8GB RAM) - ~1600₽/месяц"
    read -p "Выбор (1-3, по умолчанию: 2): " VM_TYPE
    VM_TYPE=${VM_TYPE:-2}
    
    case $VM_TYPE in
        1)
            CORES=2
            MEMORY=2
            ;;
        2)
            CORES=2
            MEMORY=4
            ;;
        3)
            CORES=4
            MEMORY=8
            ;;
        *)
            print_error "Неверный выбор"
            exit 1
            ;;
    esac
    
    read -p "🗝️  SSH ключ (путь к публичному ключу, по умолчанию: ~/.ssh/id_rsa.pub): " SSH_KEY_PATH
    SSH_KEY_PATH=${SSH_KEY_PATH:-~/.ssh/id_rsa.pub}
    
    # Проверка SSH ключа
    if [ ! -f "$SSH_KEY_PATH" ]; then
        print_error "SSH ключ не найден: $SSH_KEY_PATH"
        print_status "Создайте SSH ключ: ssh-keygen -t rsa -b 4096"
        exit 1
    fi
    
    SSH_KEY=$(cat "$SSH_KEY_PATH")
    
    print_success "Параметры VM настроены"
}

# Создание VM
create_vm() {
    print_status "Создаю VM в Yandex Cloud..."
    
    # Получаем последний образ Ubuntu 22.04
    IMAGE_ID=$(yc compute image get-latest-from-family ubuntu-2204-lts --folder-id standard-images --format json | jq -r '.id')
    
    print_status "Используется образ Ubuntu 22.04: $IMAGE_ID"
    
    # Получаем ID сети по умолчанию
    NETWORK_ID=$(yc vpc network list --format json | jq -r '.[0].id')
    if [ "$NETWORK_ID" = "null" ] || [ -z "$NETWORK_ID" ]; then
        print_error "Не найдена сеть по умолчанию"
        print_status "Создаю сеть по умолчанию..."
        NETWORK_ID=$(yc vpc network create --name default --format json | jq -r '.id')
    fi
    
    # Получаем или создаем subnet
    SUBNET_ID=$(yc vpc subnet list --format json | jq -r --arg zone "$CURRENT_ZONE" '.[] | select(.zone_id == $zone) | .id' | head -1)
    if [ "$SUBNET_ID" = "null" ] || [ -z "$SUBNET_ID" ]; then
        print_status "Создаю subnet для зоны $CURRENT_ZONE..."
        SUBNET_ID=$(yc vpc subnet create \
            --name "default-$CURRENT_ZONE" \
            --zone "$CURRENT_ZONE" \
            --range 10.128.0.0/24 \
            --network-id "$NETWORK_ID" \
            --format json | jq -r '.id')
    fi
    
    print_status "Используется subnet: $SUBNET_ID в зоне $CURRENT_ZONE"
    
    # Проверка существующих VM с таким именем
    EXISTING_VM_ID=$(yc compute instance list --format json | jq -r --arg name "$VM_NAME" '.[] | select(.name == $name) | .id' 2>/dev/null | head -1)
    
    if [ ! -z "$EXISTING_VM_ID" ] && [ "$EXISTING_VM_ID" != "null" ]; then
        print_warning "VM с именем '$VM_NAME' уже существует (ID: $EXISTING_VM_ID)"
        read -p "Хотите использовать существующую VM? (y/n): " USE_EXISTING
        
        if [[ $USE_EXISTING =~ ^[Yy] ]]; then
            VM_ID="$EXISTING_VM_ID"
            VM_IP=$(yc compute instance get "$VM_ID" --format json | jq -r '.network_interfaces[0].primary_v4_address.one_to_one_nat.address' 2>/dev/null)
            print_success "Используем существующую VM: $VM_ID с IP: $VM_IP"
            
            # Сохранение информации о VM
            cat > .vm-info << EOF
VM_ID=$VM_ID
VM_NAME=$VM_NAME
VM_IP=$VM_IP
VM_ZONE=$CURRENT_ZONE
VM_CORES=$CORES
VM_MEMORY=$MEMORY
CREATED_AT=$(date)
EOF
            return 0
        else
            print_status "Введите другое имя для VM или удалите существующую"
            exit 1
        fi
    fi
    
    # Создание VM
    print_status "Команда создания VM:"
    echo "yc compute instance create --name \"$VM_NAME\" --zone \"$CURRENT_ZONE\" --network-interface subnet-id=\"$SUBNET_ID\",nat-ip-version=ipv4 --create-boot-disk image-id=\"$IMAGE_ID\",size=20,type=network-hdd --cores \"$CORES\" --memory \"${MEMORY}GB\" --ssh-key \"$SSH_KEY_PATH\" --format json"
    
    print_status "Создаю VM... (это может занять 1-2 минуты)"
    
    VM_INFO=$(yc compute instance create \
        --name "$VM_NAME" \
        --zone "$CURRENT_ZONE" \
        --network-interface subnet-id="$SUBNET_ID",nat-ip-version=ipv4 \
        --create-boot-disk image-id="$IMAGE_ID",size=20,type=network-hdd \
        --cores "$CORES" \
        --memory "${MEMORY}GB" \
        --ssh-key "$SSH_KEY_PATH" \
        --format json 2>&1)
    
    local EXIT_CODE=$?
    
    if [ $EXIT_CODE -ne 0 ]; then
        print_error "Ошибка при создании VM (код: $EXIT_CODE)"
        echo "$VM_INFO"
        exit 1
    fi
    
    # Проверка на ошибки прав доступа
    if echo "$VM_INFO" | grep -q "Permission denied"; then
        print_error "Недостаточно прав для создания VM в folder $CURRENT_FOLDER"
        print_status "Возможные решения:"
        echo "  1. Попросите администратора добавить вам роли:"
        echo "     - compute.admin (для создания VM)"
        echo "     - vpc.admin (для создания сетей)"
        echo "  2. Переключитесь на другой folder:"
        echo "     yc config set folder-id FOLDER_ID"
        echo "  3. Создайте новый folder:"
        echo "     yc resource-manager folder create --name dog-bot-folder"
        echo ""
        print_status "Инструкция по настройке прав:"
        echo "  https://cloud.yandex.ru/docs/iam/operations/roles/grant"
        exit 1
    fi
    
    # Проверка на другие ошибки
    if echo "$VM_INFO" | grep -q "ERROR:"; then
        print_error "Ошибка при создании VM:"
        echo "$VM_INFO"
        exit 1
    fi
    
    VM_ID=$(echo "$VM_INFO" | jq -r '.id')
    
    print_success "VM создана с ID: $VM_ID"
    
    # Ожидание запуска VM
    print_status "Ожидаю запуска VM..."
    
    while true; do
        STATUS=$(yc compute instance get "$VM_ID" --format json | jq -r '.status')
        if [ "$STATUS" = "RUNNING" ]; then
            break
        fi
        echo -n "."
        sleep 3
    done
    
    echo ""
    print_success "VM запущена!"
    
    # Получение IP адреса
    VM_IP=$(yc compute instance get "$VM_ID" --format json | jq -r '.network_interfaces[0].primary_v4_address.one_to_one_nat.address')
    
    print_success "Публичный IP: $VM_IP"
    
    # Сохранение информации о VM
    cat > .vm-info << EOF
VM_ID=$VM_ID
VM_NAME=$VM_NAME
VM_IP=$VM_IP
VM_ZONE=$CURRENT_ZONE
VM_CORES=$CORES
VM_MEMORY=$MEMORY
CREATED_AT=$(date)
EOF
    
    print_success "Информация о VM сохранена в .vm-info"
}

# Настройка Security Groups (если доступно)
setup_security_groups() {
    print_status "Настройка Security Groups..."
    
    # Попытка создать security group (может не работать в некоторых регионах)
    SG_NAME="dog-bot-sg"
    
    if yc vpc security-group create \
        --name "$SG_NAME" \
        --description "Security group for Dog Feeding Bot" \
        --rule "direction=ingress,port=22,protocol=tcp,v4-cidrs=[0.0.0.0/0]" \
        --rule "direction=ingress,port=3000,protocol=tcp,v4-cidrs=[0.0.0.0/0]" \
        --rule "direction=ingress,port=80,protocol=tcp,v4-cidrs=[0.0.0.0/0]" \
        --rule "direction=ingress,port=443,protocol=tcp,v4-cidrs=[0.0.0.0/0]" \
        --rule "direction=egress,protocol=any,v4-cidrs=[0.0.0.0/0]" \
        &> /dev/null; then
        
        print_success "Security Group создана: $SG_NAME"
        
        # Присвоение security group к VM
        SG_ID=$(yc vpc security-group get "$SG_NAME" --format json | jq -r '.id')
        yc compute instance update "$VM_ID" \
            --network-interface subnet-id="$SUBNET_ID",nat-ip-version=ipv4,security-group-ids="$SG_ID" \
            &> /dev/null || true
            
    else
        print_warning "Security Groups не поддерживаются в этом регионе"
        print_status "Порты будут открыты через UFW на VM"
    fi
}

# Проверка доступности VM
test_vm_access() {
    print_status "Проверяю доступность VM..."
    
    # Ожидание готовности SSH
    print_status "Ожидаю готовности SSH сервиса..."
    
    RETRY_COUNT=0
    MAX_RETRIES=30
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if ssh -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no yc-user@"$VM_IP" exit 2>/dev/null; then
            print_success "SSH соединение установлено"
            break
        fi
        
        echo -n "."
        sleep 10
        RETRY_COUNT=$((RETRY_COUNT + 1))
    done
    
    echo ""
    
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        print_error "Не удается подключиться к VM по SSH"
        print_warning "Попробуйте подключиться позже: ssh yc-user@$VM_IP"
        return 1
    fi
}

# Вывод итоговой информации
show_summary() {
    echo ""
    echo "🎉 VM успешно создана!"
    echo "================================================================"
    echo "📋 Информация о VM:"
    echo "   Имя: $VM_NAME"
    echo "   ID: $VM_ID"
    echo "   IP: $VM_IP"
    echo "   Zone: $CURRENT_ZONE"
    echo "   CPU: $CORES vCPU"
    echo "   RAM: ${MEMORY}GB"
    echo ""
    echo "🔗 Подключение:"
    echo "   ssh yc-user@$VM_IP"
    echo ""
    echo "🚀 Следующий шаг - развертывание бота:"
    echo "   npm run deploy:yandex"
    echo ""
    echo "💡 Полезные команды:"
    echo "   yc compute instance stop $VM_ID     # Остановка VM"
    echo "   yc compute instance start $VM_ID    # Запуск VM"
    echo "   yc compute instance delete $VM_ID   # Удаление VM"
    echo ""
    echo "💰 Стоимость: ~$(($CORES * 200 + $MEMORY * 100))₽/месяц"
    echo "   (при круглосуточной работе)"
}

# Основная функция
main() {
    echo "🏗️ Создание VM для Dog Feeding Bot в Yandex Cloud"
    echo "=================================================="
    
    # Проверка yc CLI
    check_yc_cli
    
    # Проверка прав и folders
    check_permissions
    
    # Сбор параметров
    collect_vm_params
    
    # Создание VM
    create_vm
    
    # Настройка безопасности
    setup_security_groups
    
    # Проверка доступности
    if test_vm_access; then
        show_summary
        
        echo ""
        read -p "🚀 Запустить развертывание бота сейчас? (y/n): " DEPLOY_NOW
        if [[ $DEPLOY_NOW =~ ^[Yy] ]]; then
            print_status "Запускаю развертывание..."
            ./scripts/deploy-yandex.sh
        fi
    else
        show_summary
        print_warning "Подключитесь к VM позже и запустите: npm run deploy:yandex"
    fi
}

# Запуск скрипта
main "$@" 
